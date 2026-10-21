import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAuthorProfileById } from "@/lib/authors/author-profile";
import { isAuthorProfilesEnabled } from "@/lib/authors/feature-flag";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";

export type PageNotFoundProxyResult =
  | { action: "next" }
  | { action: "not_found" };

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Pure routing decision for proxy (testable without NextRequest). */
export async function resolvePageNotFoundProxy(
  pathname: string,
): Promise<PageNotFoundProxyResult> {
  const postMatch = /^\/posts\/([^/]+)\/?$/.exec(pathname);
  if (postMatch) {
    const slug = decodePathSegment(postMatch[1] ?? "");
    if (!slug) {
      return { action: "not_found" };
    }
    const post = await getPublishedPostBySlug(getDb(), slug);
    return post ? { action: "next" } : { action: "not_found" };
  }

  const authorMatch = /^\/authors\/([^/]+)(?:\/edit)?\/?$/.exec(pathname);
  if (authorMatch) {
    if (!isAuthorProfilesEnabled()) {
      return { action: "not_found" };
    }
    const authorId = decodePathSegment(authorMatch[1] ?? "");
    if (!authorId) {
      return { action: "not_found" };
    }
    const author = await getAuthorProfileById(getDb(), authorId);
    return author ? { action: "next" } : { action: "not_found" };
  }

  return { action: "next" };
}

export function pageNotFoundProxyResponse(
  result: PageNotFoundProxyResult,
): NextResponse | null {
  if (result.action === "not_found") {
    return new NextResponse(null, { status: 404 });
  }
  return null;
}
