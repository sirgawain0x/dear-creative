import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { existsAuthorProfileById } from "@/lib/authors/author-profile";
import { isAuthorProfilesEnabled } from "@/lib/authors/feature-flag";
import { existsPublishedPostBySlug } from "@/lib/posts/published-posts";
import { getCachedPublishedPostExists } from "@/lib/posts/published-posts-cache";
import { isWellFormedPostSlug } from "@/lib/posts/post-slug-format";

export type PageNotFoundProxyResult =
  | { action: "next" }
  | { action: "not_found" };

/** Internal rewrite target for App Router not-found UI. */
export const NOT_FOUND_DOCUMENT_PATH = "/_not-found";

/** Author profile URL segment guard (id in path). */
export const AUTHOR_PROFILE_ID_MAX_LENGTH = 128;
const AUTHOR_PROFILE_ID_PATTERN = /^[\w-]+$/;

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function isWellFormedAuthorProfileId(authorId: string): boolean {
  if (authorId.length === 0 || authorId.length > AUTHOR_PROFILE_ID_MAX_LENGTH) {
    return false;
  }
  return AUTHOR_PROFILE_ID_PATTERN.test(authorId);
}

/** Pure routing decision for proxy (testable without NextRequest). */
export async function resolvePageNotFoundProxy(
  pathname: string,
): Promise<PageNotFoundProxyResult> {
  const postMatch = /^\/posts\/([^/]+)\/?$/.exec(pathname);
  if (postMatch) {
    const slug = decodePathSegment(postMatch[1] ?? "");
    if (!slug || !isWellFormedPostSlug(slug)) {
      return { action: "not_found" };
    }
    try {
      const exists = await lookupPublishedPostExists(slug);
      return exists ? { action: "next" } : { action: "not_found" };
    } catch {
      return { action: "next" };
    }
  }

  const authorMatch = /^\/authors\/([^/]+)(?:\/edit)?\/?$/.exec(pathname);
  if (authorMatch) {
    if (!isAuthorProfilesEnabled()) {
      return { action: "not_found" };
    }
    const authorId = decodePathSegment(authorMatch[1] ?? "");
    if (!authorId || !isWellFormedAuthorProfileId(authorId)) {
      return { action: "not_found" };
    }
    try {
      const exists = await existsAuthorProfileById(getDb(), authorId);
      return exists ? { action: "next" } : { action: "not_found" };
    } catch {
      return { action: "next" };
    }
  }

  return { action: "next" };
}

async function lookupPublishedPostExists(slug: string): Promise<boolean> {
  try {
    return await getCachedPublishedPostExists(slug);
  } catch {
    return existsPublishedPostBySlug(getDb(), slug);
  }
}

export function notFoundDocumentUrl(requestUrl: URL): URL {
  return new URL(NOT_FOUND_DOCUMENT_PATH, requestUrl);
}

/** Serves App Router not-found HTML with a real 404 status (rewrite alone keeps 200). */
export async function pageNotFoundProxyResponse(
  result: PageNotFoundProxyResult,
  request: NextRequest,
): Promise<NextResponse | null> {
  if (result.action !== "not_found") {
    return null;
  }

  const documentUrl = notFoundDocumentUrl(request.nextUrl);
  const method = request.method.toUpperCase();

  if (method === "HEAD") {
    return new NextResponse(null, { status: 404 });
  }

  const rendered = await fetch(documentUrl, {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
      accept: request.headers.get("accept") ?? "text/html",
    },
  });
  const html = await rendered.text();
  return new NextResponse(html, {
    status: 404,
    headers: {
      "Content-Type": rendered.headers.get("Content-Type") ?? "text/html; charset=utf-8",
    },
  });
}
