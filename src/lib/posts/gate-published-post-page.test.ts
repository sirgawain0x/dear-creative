import { afterEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T,>(fn: T) => fn,
  };
});

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/posts/published-posts", () => ({
  getPublishedPostBySlug: vi.fn(),
}));

vi.mock("@/lib/paywall/reader-post", () => ({
  resolveReaderPostView: vi.fn(),
}));

import { getDb } from "@/db/client";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";
import {
  requirePublishedPostBySlug,
  shouldSkipPostReaderMetadataAtBuild,
} from "./gate-published-post-page";

describe("shouldSkipPostReaderMetadataAtBuild", () => {
  afterEach(() => {
    delete process.env.NEXT_PHASE;
  });

  it("is true during production build", () => {
    process.env.NEXT_PHASE = "phase-production-build";
    expect(shouldSkipPostReaderMetadataAtBuild()).toBe(true);
  });

  it("is false during live requests", () => {
    delete process.env.NEXT_PHASE;
    expect(shouldSkipPostReaderMetadataAtBuild()).toBe(false);
  });
});

describe("requirePublishedPostBySlug", () => {
  afterEach(() => {
    notFoundMock.mockClear();
    vi.mocked(getPublishedPostBySlug).mockReset();
  });

  it("terminates with notFound when the slug is missing or unpublished", async () => {
    vi.mocked(getDb).mockReturnValue({} as ReturnType<typeof getDb>);
    vi.mocked(getPublishedPostBySlug).mockResolvedValue(null);
    await expect(requirePublishedPostBySlug("bogus-slug")).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
