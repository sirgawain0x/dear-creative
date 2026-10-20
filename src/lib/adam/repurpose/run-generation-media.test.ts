import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { setRepurposeEnabledForTests } from "./feature-flag";
import { runRepurposeGeneration } from "./run-generation";

describe("runRepurposeGeneration media outputs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setRepurposeEnabledForTests(undefined);
  });

  it("uploads infographic image from mocked Nano Banana response", async () => {
    setRepurposeEnabledForTests(true);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "visual",
      title: "Visual",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Stats and facts.</p>",
    });

    const png = Buffer.from("PNG").toString("base64");
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: "image/png", data: png } }],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const uploadFn = vi.fn().mockResolvedValue({
      gatewayUrl: "https://api.grove.storage/infographic.png",
      uri: "lens://infographic",
      storageKey: "infographic",
    });

    const output = await runRepurposeGeneration({
      db,
      postIdOrSlug: "visual",
      outputType: "infographic",
      deps: { fetchFn, uploadFn },
    });

    expect(output.status).toBe("ready");
    expect(output.mediaUrl).toContain("grove.storage");
    expect(uploadFn).toHaveBeenCalledTimes(1);
  });
});
