import { eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { authors } from "@/db/schema";
import { isMissingColumnError } from "@/lib/db/sqlite-errors";

export type PostAuthorDetail = {
  name: string;
  slug?: string | null;
  bio?: string | null;
  tagline?: string | null;
  avatarUrl?: string | null;
  meTokenAddress?: string | null;
  meTokenSymbol?: string | null;
};

export async function getAuthorBySlug(
  db: DearCreativeDb,
  slug: string,
): Promise<PostAuthorDetail | null> {
  try {
    const [row] = await db
      .select({
        name: authors.name,
        slug: authors.slug,
        bio: authors.bio,
        tagline: authors.tagline,
        avatarUrl: authors.avatarUrl,
        meTokenAddress: authors.meTokenAddress,
        meTokenSymbol: authors.meTokenSymbol,
      })
      .from(authors)
      .where(eq(authors.slug, slug))
      .limit(1);

    if (!row) {
      return null;
    }

    return mapAuthorRow(row);
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
    const [row] = await db
      .select({
        name: authors.name,
        slug: authors.slug,
        bio: authors.bio,
        avatarUrl: authors.avatarUrl,
        meTokenAddress: authors.meTokenAddress,
        meTokenSymbol: authors.meTokenSymbol,
      })
      .from(authors)
      .where(eq(authors.slug, slug))
      .limit(1);
    if (!row) {
      return null;
    }
    return mapAuthorRow({ ...row, tagline: null });
  }
}

export function mapAuthorRow(row: {
  name: string;
  slug: string;
  bio: string | null;
  tagline?: string | null;
  avatarUrl: string | null;
  meTokenAddress: string | null;
  meTokenSymbol: string | null;
}): PostAuthorDetail {
  return {
    name: row.name,
    slug: row.slug,
    bio: row.bio,
    tagline: row.tagline ?? null,
    avatarUrl: row.avatarUrl,
    meTokenAddress: row.meTokenAddress,
    meTokenSymbol: row.meTokenSymbol,
  };
}
