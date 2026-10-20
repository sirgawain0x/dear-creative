import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { postRepurposeOutputs } from "@/db/schema";
import {
  clearRepurposeLocksForTests,
  releaseRepurposeLock,
  tryAcquireRepurposeLock,
} from "./locks";
import {
  setRepurposeEnabledForTests,
} from "./feature-flag";
import {
  RepurposeGenerationError,
  runRepurposeGeneration,
} from "./run-generation";

describe("runRepurposeGeneration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setRepurposeEnabledForTests(undefined);
    clearRepurposeLocksForTests();
  });

  it("returns 503 when feature flag is off", async () => {
    setRepurposeEnabledForTests(false);
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "demo",
      title: "Demo",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Hello world</p>",
    });
    await expect(
      runRepurposeGeneration({
        db,
        postIdOrSlug: "demo",
        outputType: "mind_map",
      }),
    ).rejects.toMatchObject({ httpStatus: 503 });
  });

  it("generates structured JSON once and stores ready output", async () => {
    setRepurposeEnabledForTests(true);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "ideas",
      title: "Creative Ideas",
      status: "draft",
      publishedAt: null,
      bodyHtml: "<p>Body text for repurposing.</p>",
    });

    const mockPayload = { title: "Mind", root: { label: "Root", children: [] } };
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(mockPayload) }],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const output = await runRepurposeGeneration({
      db,
      postIdOrSlug: "ideas",
      outputType: "mind_map",
      deps: { fetchFn },
    });

    expect(output.status).toBe("ready");
    expect(output.payload).toEqual(mockPayload);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const cached = await runRepurposeGeneration({
      db,
      postIdOrSlug: "ideas",
      outputType: "mind_map",
      deps: { fetchFn },
    });
    expect(cached.id).toBe(output.id);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when a lock is held", async () => {
    setRepurposeEnabledForTests(true);
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "locked",
      title: "Locked",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Text</p>",
    });
    const row = await db.query.posts.findFirst({
      where: (posts, { eq: eqFn }) => eqFn(posts.slug, "locked"),
    });
    if (!row) throw new Error("missing post");
    expect(tryAcquireRepurposeLock(row.id, "quiz")).toBe(true);

    await expect(
      runRepurposeGeneration({
        db,
        postIdOrSlug: "locked",
        outputType: "quiz",
      }),
    ).rejects.toBeInstanceOf(RepurposeGenerationError);

    releaseRepurposeLock(row.id, "quiz");
  });

  it("returns 409 when db row is already generating", async () => {
    setRepurposeEnabledForTests(true);
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "running",
      title: "Running",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Text</p>",
    });
    const row = await db.query.posts.findFirst({
      where: (posts, { eq: eqFn }) => eqFn(posts.slug, "running"),
    });
    if (!row) throw new Error("missing post");
    await db.insert(postRepurposeOutputs).values({
      id: "out-1",
      postId: row.id,
      outputType: "report",
      status: "generating",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      runRepurposeGeneration({
        db,
        postIdOrSlug: "running",
        outputType: "report",
      }),
    ).rejects.toMatchObject({ httpStatus: 409 });
  });
});
