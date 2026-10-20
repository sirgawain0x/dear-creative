import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { setRepurposeEnabledForTests } from "@/lib/adam/repurpose/feature-flag";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getDb: getDbMock,
}));

describe("POST /api/adam/posts/[postId]/repurpose/[outputType]", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getDbMock.mockReset();
    setRepurposeEnabledForTests(undefined);
  });

  it("requires studio auth", async () => {
    setRepurposeEnabledForTests(true);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/adam/posts/x/repurpose/mind_map", {
        method: "POST",
      }),
      { params: Promise.resolve({ postId: "x", outputType: "mind_map" }) },
    );
    expect(response.status).toBe(401);
  });

  it("generates mind_map with mocked Gemini", async () => {
    vi.stubEnv("ADAM_API_TOKEN", "secret-token");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    setRepurposeEnabledForTests(true);
    const db = await createPostsTestDb();
    getDbMock.mockReturnValue(db);
    await insertPost(db, {
      slug: "repurpose-me",
      title: "Repurpose Me",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Article body.</p>",
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: "Map",
                      root: { label: "A", children: [] },
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
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/adam/posts/repurpose-me/repurpose/mind_map", {
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
      }),
      {
        params: Promise.resolve({
          postId: "repurpose-me",
          outputType: "mind_map",
        }),
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      output?: { status: string; outputType: string };
    };
    expect(body.output?.status).toBe("ready");
    expect(body.output?.outputType).toBe("mind_map");
  });
});
