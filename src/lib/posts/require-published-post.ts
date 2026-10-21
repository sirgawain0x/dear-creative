import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getPublishedPostBySlug } from "./published-posts";
import type { PublishedPostDetail } from "./published-posts";

/** Loads a published post or terminates with HTTP 404 (must run before streaming). */
export async function requirePublishedPostBySlug(
  slug: string,
): Promise<PublishedPostDetail> {
  const post = await getPublishedPostBySlug(getDb(), slug);
  if (!post) {
    notFound();
  }
  return post;
}
