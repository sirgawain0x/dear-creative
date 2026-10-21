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

import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";
import {
  buildFailClosedPublishedAsOf,
  isNextProductionBuildPhase,
  rejectMissingPublishedPostSlug,
  requirePublishedPostBySlug,
} from "./gate-published-post-page";

describe("isNextProductionBuildPhase", () => {
  afterEach(() => {
    delete process.env.NEXT_PHASE;
  });

  it("is true during production build", () => {
    process.env.NEXT_PHASE = "phase-production-build";
    expect(isNextProductionBuildPhase()).toBe(true);
  });

  it("is false during live requests", () => {
    delete process.env.NEXT_PHASE;
    expect(isNextProductionBuildPhase()).toBe(false);
  });
});

describe("rejectMissingPublishedPostSlug", () => {
  afterEach(() => {
    notFoundMock.mockClear();
    vi.mocked(getPublishedPostBySlug).mockReset();
    vi.mocked(connection).mockClear();
    delete process.env.NEXT_PHASE;
  });

  it("uses fail-closed epoch as-of during production build without connection", async () => {
    process.env.NEXT_PHASE = "phase-production-build";
    vi.mocked(getDb).mockReturnValue({} as ReturnType<typeof getDb>);
    vi.mocked(getPublishedPostBySlug).mockResolvedValue(null);
    await expect(rejectMissingPublishedPostSlug("bogus-slug")).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(connection).not.toHaveBeenCalled();
    expect(getPublishedPostBySlug).toHaveBeenCalledWith(
      expect.anything(),
      "bogus-slug",
      { asOf: buildFailClosedPublishedAsOf() },
    );
  });

  it("awaits connection before reading current time at request time", async () => {
    vi.mocked(getDb).mockReturnValue({} as ReturnType<typeof getDb>);
    vi.mocked(getPublishedPostBySlug).mockResolvedValue({
      slug: "live-post",
    } as Awaited<ReturnType<typeof getPublishedPostBySlug>>);
    await rejectMissingPublishedPostSlug("live-post");
    expect(connection).toHaveBeenCalledTimes(1);
    const options = vi.mocked(getPublishedPostBySlug).mock.calls[0]?.[2];
    expect(options?.asOf).toBeInstanceOf(Date);
    expect(options?.asOf?.getTime()).not.toBe(
      buildFailClosedPublishedAsOf().getTime(),
    );
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
