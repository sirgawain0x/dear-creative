import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import {
  getAuthorProfileById,
  type AuthorProfileRecord,
} from "@/lib/authors/author-profile";
import { isAuthorProfilesEnabled } from "@/lib/authors/feature-flag";

/**
 * Author profile routes must call this before any Suspense boundary so
 * notFound() yields a real HTTP 404 under cacheComponents / PPR.
 */
export async function gateAuthorProfilePage(
  authorId: string,
): Promise<AuthorProfileRecord> {
  if (!isAuthorProfilesEnabled()) {
    notFound();
  }
  const author = await getAuthorProfileById(getDb(), authorId);
  if (!author) {
    notFound();
  }
  await connection();
  return author;
}
