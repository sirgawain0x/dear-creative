import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { buildPostPageMetadata } from "@/lib/posts/post-page-metadata";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";
import { AdamStudio } from "./adam-studio";
import { STUDIO_PAGE_MAIN_CLASS } from "./studio-page-main-class";

export async function generateMetadata({
  searchParams,
}: PageProps<"/adam">): Promise<Metadata> {
  const { slug } = await searchParams;
  const postSlug = (Array.isArray(slug) ? slug[0] : slug)?.trim();
  if (!postSlug) return {};

  await connection();
  const post = await getPublishedPostBySlug(getDb(), postSlug);
  return post ? buildPostPageMetadata(post) : {};
}

async function RequestTimeMetadata() {
  // Signal that query-dependent metadata is intentional while keeping the studio shell prerenderable.
  await connection();
  return null;
}

export default function AdamPage() {
  return (
    <main className={STUDIO_PAGE_MAIN_CLASS}>
      <AdamStudio initialTab="chat" />
      <Suspense fallback={null}>
        <RequestTimeMetadata />
      </Suspense>
    </main>
  );
}
