import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { authors, posts } from "@/db/schema";
import {
  validateAuthorDisplayName,
  validateAuthorTagline,
} from "@/lib/authors/author-display-profile-limits";
import { formatPublishedDateEt } from "@/lib/posts/format-published-date";

export type AuthorProfileRecord = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  tagline: string | null;
  avatarUrl: string | null;
};

export type AuthorPublishedArticle = {
  id: string;
  slug: string;
  title: string;
  publishedAtLabel: string | null;
  /** Primary author vs collaboration (when co-writer data exists). */
  role: "author" | "cowriter";
};

function isMissingColumnError(error: unknown): boolean {
  const parts: string[] = [];
  if (error instanceof Error) {
    parts.push(error.message);
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) {
      parts.push(cause.message);
    } else if (cause) {
      parts.push(String(cause));
    }
  } else {
    parts.push(String(error));
  }
  return parts.some((message) => /no such column/i.test(message));
}

/**
 * Loads author profile fields, omitting avatar when the column is not migrated yet.
 */
export async function existsAuthorProfileById(
  db: DearCreativeDb,
  authorId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: authors.id })
    .from(authors)
    .where(eq(authors.id, authorId))
    .limit(1);
  return Boolean(row);
}

export async function getAuthorProfileById(
  db: DearCreativeDb,
  authorId: string,
): Promise<AuthorProfileRecord | null> {
  try {
    const [row] = await db
      .select({
        id: authors.id,
        name: authors.name,
        slug: authors.slug,
        bio: authors.bio,
        tagline: authors.tagline,
        avatarUrl: authors.avatarUrl,
      })
      .from(authors)
      .where(eq(authors.id, authorId))
      .limit(1);
    return row ?? null;
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
    try {
      const [row] = await db
        .select({
          id: authors.id,
          name: authors.name,
          slug: authors.slug,
          bio: authors.bio,
          avatarUrl: authors.avatarUrl,
        })
        .from(authors)
        .where(eq(authors.id, authorId))
        .limit(1);
      if (!row) {
        return null;
      }
      return { ...row, tagline: null };
    } catch (innerError) {
      if (!isMissingColumnError(innerError)) {
        throw innerError;
      }
      const [row] = await db
        .select({
          id: authors.id,
          name: authors.name,
          slug: authors.slug,
          bio: authors.bio,
        })
        .from(authors)
        .where(eq(authors.id, authorId))
        .limit(1);
      if (!row) {
        return null;
      }
      return { ...row, tagline: null, avatarUrl: null };
    }
  }
}

async function listCoWrittenPostIds(
  db: DearCreativeDb,
  authorId: string,
): Promise<string[]> {
  /**
   * CO_WRITE_HOOK (#46): when `post_writers` is migrated, include accepted
   * co-writer rows. Until then this query fails softly and returns [].
   */
  try {
    const rows = await db.all<{ post_id: string }>(
      sql`SELECT post_id FROM post_writers
          WHERE writer_id = ${authorId}
            AND status = 'accepted'
            AND role = 'cowriter'`,
    );
    return rows.map((row) => row.post_id).filter(Boolean);
  } catch {
    return [];
  }
}

export async function listPublishedArticlesForAuthor(
  db: DearCreativeDb,
  authorId: string,
): Promise<AuthorPublishedArticle[]> {
  const authoredRows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(and(eq(posts.authorId, authorId), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt));

  const coWrittenIds = await listCoWrittenPostIds(db, authorId);
  const authoredIds = new Set(authoredRows.map((row) => row.id));

  let coWrittenRows: typeof authoredRows = [];
  if (coWrittenIds.length > 0) {
    const idsToLoad = coWrittenIds.filter((id) => !authoredIds.has(id));
    if (idsToLoad.length > 0) {
      coWrittenRows = await db
        .select({
          id: posts.id,
          slug: posts.slug,
          title: posts.title,
          publishedAt: posts.publishedAt,
        })
        .from(posts)
        .where(
          and(inArray(posts.id, idsToLoad), eq(posts.status, "published")),
        )
        .orderBy(desc(posts.publishedAt));
    }
  }

  const merged = [
    ...authoredRows.map((row) => ({ ...row, role: "author" as const })),
    ...coWrittenRows.map((row) => ({ ...row, role: "cowriter" as const })),
  ].sort((a, b) => {
    const aTime = a.publishedAt?.getTime() ?? 0;
    const bTime = b.publishedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return merged.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    publishedAtLabel: row.publishedAt
      ? formatPublishedDateEt(row.publishedAt.toISOString())
      : null,
    role: row.role,
  }));
}

export async function updateAuthorDisplayProfile(
  db: DearCreativeDb,
  authorId: string,
  input: {
    name?: string;
    tagline?: string | null;
    avatarUrl?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch: {
    name?: string;
    tagline?: string | null;
    avatarUrl?: string | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    const nameResult = validateAuthorDisplayName(input.name);
    if (!nameResult.ok) {
      return nameResult;
    }
    patch.name = nameResult.value;
  }

  if (input.tagline !== undefined) {
    const taglineResult = validateAuthorTagline(input.tagline);
    if (!taglineResult.ok) {
      return taglineResult;
    }
    patch.tagline = taglineResult.value;
  }

  if (input.avatarUrl !== undefined) {
    patch.avatarUrl = input.avatarUrl;
  }

  try {
    await db.update(authors).set(patch).where(eq(authors.id, authorId));
    return { ok: true };
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
    const withoutMissing = { ...patch };
    if (input.avatarUrl !== undefined) {
      delete withoutMissing.avatarUrl;
    }
    if (input.tagline !== undefined) {
      delete withoutMissing.tagline;
    }
    await db
      .update(authors)
      .set(withoutMissing)
      .where(eq(authors.id, authorId));
    return { ok: true };
  }
}

/** @internal tests */
export async function authorRecordExists(
  db: DearCreativeDb,
  authorId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: authors.id })
    .from(authors)
    .where(eq(authors.id, authorId))
    .limit(1);
  return Boolean(row);
}
