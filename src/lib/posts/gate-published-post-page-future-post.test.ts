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

vi.mock("@/lib/paywall/reader-post", () => ({
  resolveReaderPostView: vi.fn(),
}));

import { connection } from "next/server";
import { getDb } from "@/db/client";
import { rejectMissingPublishedPostSlug } from "./gate-published-post-page";
import {
  createPostsTestDb,
  insertPost,
} from "./test-support/posts-test-db";

describe("rejectMissingPublishedPostSlug future-dated publishes", () => {
  afterEach(() => {
    notFoundMock.mockClear();
    vi.mocked(connection).mockClear();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    delete process.env.NEXT_PHASE;
  });

  it("is not visible at build time or at request time", async () => {
    const db = await createPostsTestDb();
    const futurePublish = new Date("2099-06-01T00:00:00.000Z");
    await insertPost(db, {
      slug: "scheduled-later",
      title: "Scheduled",
      status: "published",
      publishedAt: futurePublish,
    });
    vi.mocked(getDb).mockReturnValue(db);

    process.env.NEXT_PHASE = "phase-production-build";
    await expect(
      rejectMissingPublishedPostSlug("scheduled-later"),
    ).rejects.toThrow("NOT_FOUND");
    expect(connection).not.toHaveBeenCalled();

    delete process.env.NEXT_PHASE;
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await expect(
      rejectMissingPublishedPostSlug("scheduled-later"),
    ).rejects.toThrow("NOT_FOUND");
    expect(connection).toHaveBeenCalledTimes(1);
  });
});
