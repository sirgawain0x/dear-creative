import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { postRepurposeOutputs } from "@/db/schema";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import {
  claimRepurposeGenerationLock,
  getRepurposeOutput,
  saveRepurposeFailed,
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
        } as ReturnType<typeof db.insert>;
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

describe("saveRepurposeReady / saveRepurposeFailed rowId guard", () => {
  it("does not overwrite when rowId does not match the active generating claim", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "stale",
      title: "T",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>x</p>",
    });
    const post = await db.query.posts.findFirst({
      where: (p, { eq }) => eq(p.slug, "stale"),
    });
    if (!post) throw new Error("missing post");

    const activeId = randomUUID();
    const staleId = randomUUID();
    const now = new Date();
    await db.insert(postRepurposeOutputs).values({
      id: activeId,
      postId: post.id,
      outputType: "quiz",
      status: "generating",
      payloadJson: null,
      mediaUrl: null,
      mediaMimeType: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    await saveRepurposeFailed({
      db,
      rowId: staleId,
      postId: post.id,
      outputType: "quiz",
      errorMessage: "stale worker failure",
    });

    const row = await getRepurposeOutput(db, post.id, "quiz");
    expect(row?.status).toBe("generating");
    expect(row?.errorMessage).toBeNull();

    await expect(
      saveRepurposeReady({
        db,
        rowId: staleId,
        postId: post.id,
        outputType: "quiz",
        payload: { title: "Q", questions: [] },
      }),
    ).rejects.toThrow(/no longer active/);
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
