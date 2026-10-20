import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authors,
  postRepurposeOutputs,
  posts,
  subscriptions,
  writers,
} from "@/db/schema";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { REPURPOSE_GENERATING_TTL_MS } from "./constants";
import {
  setRepurposeEnabledForTests,
} from "./feature-flag";
import {
  RepurposeGenerationError,
  getRepurposeOutputForPost,
  runRepurposeGeneration,
} from "./run-generation";
import { claimRepurposeGenerationLock } from "./storage";
import { setPostAuthorIdForTests } from "./post-source";

const adamAuth = {
  ok: true as const,
  actor: "adam-token",
  mode: "adam_token" as const,
};

const privyAuth = {
  ok: true as const,
  actor: "did:privy:writer-one",
  mode: "privy_admin" as const,
};

async function seedOwnedDraft(db: Awaited<ReturnType<typeof createPostsTestDb>>) {
  const writerId = randomUUID();
  await db.insert(writers).values({ id: writerId });
  await db.insert(authors).values({
    id: writerId,
    name: "Writer",
    slug: `writer-${writerId.slice(0, 8)}`,
    payoutAddress: "0x0000000000000000000000000000000000000001",
  });
  await insertPost(db, {
    slug: "owned-draft",
    title: "Owned",
    status: "draft",
    publishedAt: null,
    bodyHtml: "<p>Body</p>",
  });
  const row = await db.query.posts.findFirst({
    where: (p, { eq: eqFn }) => eqFn(p.slug, "owned-draft"),
  });
  if (!row) throw new Error("missing post");
  await setPostAuthorIdForTests(db, row.id, writerId);
  await db.insert(subscriptions).values({
    id: randomUUID(),
    privyUserId: privyAuth.actor,
    wallet: "0xabc",
    writerId,
    plan: "monthly",
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 86_400_000),
    status: "active",
  });
  return row.id;
}

function mockGeminiMindMap(fetchFn: ReturnType<typeof vi.fn>) {
  fetchFn.mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: "Map",
                    root: { label: "Root", children: [] },
                  }),
                },
              ],
            },
          },
        ],
      }),
      { status: 200 },
    ),
  );
}

describe("runRepurposeGeneration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setRepurposeEnabledForTests(undefined);
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
        auth: adamAuth,
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
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Body text for repurposing.</p>",
    });

    const fetchFn = vi.fn();
    mockGeminiMindMap(fetchFn);

    const output = await runRepurposeGeneration({
      db,
      postIdOrSlug: "ideas",
      outputType: "mind_map",
      auth: adamAuth,
      deps: { fetchFn },
    });

    expect(output.status).toBe("ready");
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const cached = await runRepurposeGeneration({
      db,
      postIdOrSlug: "ideas",
      outputType: "mind_map",
      auth: adamAuth,
      deps: { fetchFn },
    });
    expect(cached.id).toBe(output.id);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("returns 409 for concurrent claims", async () => {
    setRepurposeEnabledForTests(true);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "race",
      title: "Race",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Text</p>",
    });
    const row = await db.query.posts.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.slug, "race"),
    });
    if (!row) throw new Error("missing post");

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchFn = vi.fn().mockImplementation(async () => {
      await gate;
      return new Response("{}", { status: 500 });
    });

    const first = runRepurposeGeneration({
      db,
      postIdOrSlug: "race",
      outputType: "quiz",
      auth: adamAuth,
      deps: { fetchFn },
    });
    await vi.waitFor(async () => {
      const current = await getRepurposeOutputForPost(db, row.id, "quiz");
      expect(current?.status).toBe("generating");
    });

    await expect(
      runRepurposeGeneration({
        db,
        postIdOrSlug: "race",
        outputType: "quiz",
        auth: adamAuth,
        deps: { fetchFn },
      }),
    ).rejects.toMatchObject({ httpStatus: 409 });

    release();
    await first.catch(() => undefined);
  });

  it("reclaims stale generating locks", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "stale",
      title: "Stale",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Text</p>",
    });
    const row = await db.query.posts.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.slug, "stale"),
    });
    if (!row) throw new Error("missing post");
    const staleAt = new Date(Date.now() - REPURPOSE_GENERATING_TTL_MS - 5_000);
    await db.insert(postRepurposeOutputs).values({
      id: randomUUID(),
      postId: row.id,
      outputType: "report",
      status: "generating",
      createdAt: staleAt,
      updatedAt: staleAt,
    });

    const claim = await claimRepurposeGenerationLock({
      db,
      postId: row.id,
      outputType: "report",
    });
    expect(claim.outcome).toBe("claimed");
  });

  it("marks row failed after malformed model JSON", async () => {
    setRepurposeEnabledForTests(true);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "bad-json",
      title: "Bad",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Text</p>",
    });
    const row = await db.query.posts.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.slug, "bad-json"),
    });
    if (!row) throw new Error("missing post");

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ title: "missing root" }) }],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(
      runRepurposeGeneration({
        db,
        postIdOrSlug: "bad-json",
        outputType: "mind_map",
        auth: adamAuth,
        deps: { fetchFn },
      }),
    ).rejects.toBeInstanceOf(RepurposeGenerationError);

    const stored = await getRepurposeOutputForPost(db, row.id, "mind_map");
    expect(stored?.status).toBe("failed");
  });

  it("marks row failed when text type is unsupported in this release (501)", async () => {
    setRepurposeEnabledForTests(true);
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "media",
      title: "Media",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Text</p>",
    });
    const row = await db.query.posts.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.slug, "media"),
    });
    if (!row) throw new Error("missing post");

    await expect(
      runRepurposeGeneration({
        db,
        postIdOrSlug: "media",
        outputType: "audio_overview",
        auth: adamAuth,
      }),
    ).rejects.toMatchObject({ httpStatus: 501 });

    const stored = await getRepurposeOutputForPost(db, row.id, "audio_overview");
    expect(stored?.status).toBe("failed");
  });

  it("denies draft repurpose when caller is not the owning writer", async () => {
    setRepurposeEnabledForTests(true);
    const db = await createPostsTestDb();
    await seedOwnedDraft(db);
    await expect(
      runRepurposeGeneration({
        db,
        postIdOrSlug: "owned-draft",
        outputType: "mind_map",
        auth: {
          ok: true,
          actor: "did:privy:someone-else",
          mode: "privy_admin",
        },
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });

  it("allows draft repurpose for owning writer", async () => {
    setRepurposeEnabledForTests(true);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const db = await createPostsTestDb();
    await seedOwnedDraft(db);
    const fetchFn = vi.fn();
    mockGeminiMindMap(fetchFn);
    const output = await runRepurposeGeneration({
      db,
      postIdOrSlug: "owned-draft",
      outputType: "mind_map",
      auth: privyAuth,
      deps: { fetchFn },
    });
    expect(output.status).toBe("ready");
  });
});
