import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { authors, posts } from "@/db/schema";
import { formatPublishedDateEt } from "@/lib/posts/format-published-date";

export type AuthorProfileRecord = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
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
    return { ...row, avatarUrl: null };
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
  input: { name?: string; avatarUrl?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name?.trim();
  if (name !== undefined && name.length === 0) {
    return { ok: false, error: "Display name cannot be empty" };
  }
  if (name !== undefined && name.length > 120) {
    return { ok: false, error: "Display name is too long" };
  }

  const patch: { name?: string; avatarUrl?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (name !== undefined) {
    patch.name = name;
  }
  if (input.avatarUrl !== undefined) {
    patch.avatarUrl = input.avatarUrl;
  }

  try {
    await db.update(authors).set(patch).where(eq(authors.id, authorId));
    return { ok: true };
  } catch (error) {
    if (isMissingColumnError(error) && input.avatarUrl !== undefined) {
      const withoutAvatar = { ...patch };
      delete withoutAvatar.avatarUrl;
      await db.update(authors).set(withoutAvatar).where(eq(authors.id, authorId));
      return { ok: true };
    }
    throw error;
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
