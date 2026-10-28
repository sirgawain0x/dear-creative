import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import {
  PREVIEW_PAGE_CACHE_CONTROL,
  PREVIEW_PAGE_REFERRER_POLICY,
  PREVIEW_PAGE_X_ROBOTS_TAG,
} from "@/lib/preview-links/preview-response-headers";

vi.mock("@/lib/routing/page-not-found-proxy", () => ({
  resolvePageNotFoundProxy: vi.fn(async () => ({ action: "next" })),
  pageNotFoundProxyResponse: vi.fn(() => null),
  NOT_FOUND_DOCUMENT_PATH: "/_not-found",
}));

function fakeRequest(url: string, method = "GET"): NextRequest {
  const nextUrl = new URL(url);
  return {
    method,
    headers: new Headers(),
    nextUrl,
    url: nextUrl.toString(),
  } as NextRequest;
}

describe("proxy preview route headers", () => {
  it("sets Cache-Control, X-Robots-Tag, and Referrer-Policy on /preview/*", async () => {
    const { proxy } = await import("./proxy");
    const response = await proxy(
      fakeRequest("https://dear.example.test/preview/some-token"),
    );
    expect(response.headers.get("Cache-Control")).toBe(PREVIEW_PAGE_CACHE_CONTROL);
    expect(response.headers.get("X-Robots-Tag")).toBe(PREVIEW_PAGE_X_ROBOTS_TAG);
    expect(response.headers.get("Referrer-Policy")).toBe(
      PREVIEW_PAGE_REFERRER_POLICY,
    );
  });

  it("does not set preview headers on non-preview routes", async () => {
    const { proxy } = await import("./proxy");
    const response = await proxy(
      fakeRequest("https://dear.example.test/posts/hello"),
    );
    expect(response.headers.get("Referrer-Policy")).toBeNull();
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
  });
});
