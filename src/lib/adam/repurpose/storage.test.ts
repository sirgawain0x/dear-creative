import { describe, expect, it, vi } from "vitest";
import { postRepurposeOutputs } from "@/db/schema";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { REPURPOSE_GENERATING_TTL_MS } from "./constants";
import {
  claimRepurposeGenerationLock,
  getRepurposeOutput,
  saveRepurposeReady,
  toClientRepurposeOutput,
} from "./storage";

describe("claimRepurposeGenerationLock insert errors", () => {
  it("rethrows non-unique insert failures", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "claim-err",
      title: "T",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>x</p>",
    });
    const post = await db.query.posts.findFirst({
      where: (p, { eq }) => eq(p.slug, "claim-err"),
    });
    if (!post) throw new Error("missing post");

    const originalInsert = db.insert.bind(db);
    vi.spyOn(db, "insert").mockImplementation((table) => {
      if (table === postRepurposeOutputs) {
        return {
          values: async () => {
            throw new Error("disk I/O error");
          },
        } as unknown as ReturnType<typeof db.insert>;
      }
      return originalInsert(table);
    });

    await expect(
      claimRepurposeGenerationLock({
        db,
        postId: post.id,
        outputType: "mind_map",
      }),
    ).rejects.toThrow(/disk I\/O error/);
  });
});

describe("saveRepurposeReady claim_token guard", () => {
  it("rejects stale worker after TTL reclaim gives another worker a new token", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "reclaim",
      title: "T",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>x</p>",
    });
    const post = await db.query.posts.findFirst({
      where: (p, { eq }) => eq(p.slug, "reclaim"),
    });
    if (!post) throw new Error("missing post");

    const workerAStart = new Date("2026-01-01T00:00:00.000Z");
    const claimA = await claimRepurposeGenerationLock({
      db,
      postId: post.id,
      outputType: "quiz",
      now: workerAStart,
    });
    expect(claimA.outcome).toBe("claimed");
    if (claimA.outcome !== "claimed") throw new Error("expected claim");

    const workerBTime = new Date(
      workerAStart.getTime() + REPURPOSE_GENERATING_TTL_MS + 1_000,
    );
    const claimB = await claimRepurposeGenerationLock({
      db,
      postId: post.id,
      outputType: "quiz",
      now: workerBTime,
    });
    expect(claimB.outcome).toBe("claimed");
    if (claimB.outcome !== "claimed") throw new Error("expected reclaim");

    expect(claimB.rowId).toBe(claimA.rowId);
    expect(claimB.claimToken).not.toBe(claimA.claimToken);

    await expect(
      saveRepurposeReady({
        db,
        rowId: claimA.rowId,
        claimToken: claimA.claimToken,
        postId: post.id,
        outputType: "quiz",
        payload: {
          title: "Stale",
          questions: [
            {
              prompt: "Q",
              choices: ["a", "b"],
              correctIndex: 0,
              explanation: "e",
            },
          ],
        },
      }),
    ).rejects.toThrow(/no longer active/);

    const saved = await saveRepurposeReady({
      db,
      rowId: claimB.rowId,
      claimToken: claimB.claimToken,
      postId: post.id,
      outputType: "quiz",
      payload: {
        title: "Fresh",
        questions: [
          {
            prompt: "Q",
            choices: ["a", "b"],
            correctIndex: 0,
            explanation: "e",
          },
        ],
      },
    });

    expect(saved.status).toBe("ready");
    const row = await getRepurposeOutput(db, post.id, "quiz");
    expect(row?.status).toBe("ready");
  });
});

describe("toClientRepurposeOutput", () => {
  it("replaces raw failed errorMessage with a generic client message", () => {
    const sanitized = toClientRepurposeOutput({
      id: "1",
      postId: "p",
      outputType: "mind_map",
      status: "failed",
      payload: null,
      mediaUrl: null,
      mediaMimeType: null,
      errorMessage: "Gemini returned invalid JSON",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(sanitized.errorMessage).toBe("Generation failed.");
  });
});
