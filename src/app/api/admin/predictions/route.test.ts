import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DearCreativeDb } from "@/db/client";
import { predictions } from "@/db/schema";
import { createPostsTestDb } from "@/lib/posts/test-support/posts-test-db";
import {
  resetPrivyTokenVerifierForTests,
  setPrivyTokenVerifierForTests,
} from "@/lib/privy/verify";
import { POST } from "./route";

const { getDb } = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getDb,
}));

describe("POST /api/admin/predictions", () => {
  let db: DearCreativeDb;

  afterEach(() => {
    resetPrivyTokenVerifierForTests();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    db = await createPostsTestDb();
    getDb.mockReturnValue(db);
    vi.stubEnv("PRIVY_ADMIN_USER_IDS", "did:privy:admin-user");
    setPrivyTokenVerifierForTests({
      verifyAuthToken: vi.fn().mockResolvedValue({
        userId: "did:privy:admin-user",
        sessionId: "sess_test",
      }),
    });
  });

  const validBody = {
    questionId:
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    questionText: "Will ingest work?",
    txHash:
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    slug: "ingest-demo",
  };

  it("returns 401 without authorization", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin privy user", async () => {
    setPrivyTokenVerifierForTests({
      verifyAuthToken: vi.fn().mockResolvedValue({
        userId: "did:privy:not-admin",
        sessionId: "sess_test",
      }),
    });

    const res = await POST(
      new Request("http://localhost/api/admin/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-token",
        },
        body: JSON.stringify(validBody),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid questionId", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-token",
        },
        body: JSON.stringify({ ...validBody, questionId: "0x123" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("inserts a pending prediction for admin callers", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-token",
        },
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      ok: boolean;
      prediction: { id: string; articleSlug: string };
    };
    expect(payload.ok).toBe(true);
    expect(payload.prediction.articleSlug).toBe("ingest-demo");

    const rows = await db.select().from(predictions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("pending");
    expect(rows[0]?.questionId).toBe(validBody.questionId.toLowerCase());
  });

  it("returns 409 when questionId already exists", async () => {
    await db.insert(predictions).values({
      id: randomUUID(),
      questionId: validBody.questionId.toLowerCase(),
      articleSlug: "other",
      questionText: "Existing",
      txHash: validBody.txHash.toLowerCase(),
      status: "pending",
    });

    const res = await POST(
      new Request("http://localhost/api/admin/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-token",
        },
        body: JSON.stringify(validBody),
      }),
    );
    expect(res.status).toBe(409);
  });
});
