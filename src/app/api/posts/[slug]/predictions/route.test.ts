import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DearCreativeDb } from "@/db/client";
import { predictions } from "@/db/schema";
import { createPostsTestDb } from "@/lib/posts/test-support/posts-test-db";
import { GET } from "./route";

const { getDb } = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getDb,
}));

describe("GET /api/posts/[slug]/predictions", () => {
  let db: DearCreativeDb;

  beforeEach(async () => {
    db = await createPostsTestDb();
    getDb.mockReturnValue(db);
  });

  it("returns an empty list when no predictions exist for the slug", async () => {
    const res = await GET(new Request("http://localhost/api/posts/empty-slug/predictions"), {
      params: Promise.resolve({ slug: "empty-slug" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; predictions: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.predictions).toEqual([]);
  });

  it("returns formatted predictions for a populated slug", async () => {
    const slug = "oracle-demo-post";
    const questionText =
      'Will the demo resolve?␟["No","Yes"]␟editorial␟en_US';

    await db.insert(predictions).values({
      id: randomUUID(),
      questionId:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      articleSlug: slug,
      questionText,
      bondToken: "ETH",
      minBondWei: "10000000000000000",
      txHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      status: "pending",
    });

    const res = await GET(new Request(`http://localhost/api/posts/${slug}/predictions`), {
      params: Promise.resolve({ slug }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      predictions: Array<{
        title: string;
        outcomes: string[];
        articleSlug: string;
        status: string;
      }>;
    };
    expect(body.ok).toBe(true);
    expect(body.predictions).toHaveLength(1);
    expect(body.predictions[0]?.articleSlug).toBe(slug);
    expect(body.predictions[0]?.title).toBe("Will the demo resolve?");
    expect(body.predictions[0]?.outcomes).toEqual(["No", "Yes"]);
    expect(body.predictions[0]?.status).toBe("pending");
  });

  it("returns an empty list for an unknown slug (no matching rows)", async () => {
    const res = await GET(
      new Request("http://localhost/api/posts/no-such-post/predictions"),
      {
        params: Promise.resolve({ slug: "no-such-post" }),
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; predictions: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.predictions).toEqual([]);
  });

  it("returns 400 when slug is missing", async () => {
    const res = await GET(new Request("http://localhost/api/posts//predictions"), {
      params: Promise.resolve({ slug: "" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("Missing slug");
  });

  it("returns 500 when the database throws", async () => {
    getDb.mockImplementation(() => {
      throw new Error("db unavailable");
    });

    const res = await GET(new Request("http://localhost/api/posts/any/predictions"), {
      params: Promise.resolve({ slug: "any" }),
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("db unavailable");
  });
});
