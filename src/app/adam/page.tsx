import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { buildPostPageMetadata } from "@/lib/posts/post-page-metadata";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";
import { STUDIO_PAGE_MAIN_CLASS } from "./studio-page-main-class";
import { StudioAccessGate } from "./studio-access-gate";

export const instant = false;

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

function StudioAccessFallback() {
  return (
    <div className="min-w-0 w-full">
      <p className="text-zinc-500">Loading Adam Studio…</p>
    </div>
  );
}

/**
 * Adam Studio is members-only. `StudioAccessGate` checks the Privy session's
 * linked wallets against the Studio allowlist and the Creative Creator Pass.
 */
export default function AdamPage() {
  return (
    <main className={STUDIO_PAGE_MAIN_CLASS}>
      <Suspense fallback={<StudioAccessFallback />}>
        <StudioAccessGate initialTab="chat" />
      </Suspense>
      <Suspense fallback={null}>
        <RequestTimeMetadata />
      </Suspense>
    </main>
  );
}
