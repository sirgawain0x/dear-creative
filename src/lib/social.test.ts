import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setXLiveEnabledForTests,
} from "@/lib/x/feature-flag";
import {
  broadcastOracleResolution,
  resetTwitterClientForTests,
  setTwitterClientForTests,
} from "./social";

describe("social syndication", () => {
  beforeEach(() => {
    resetTwitterClientForTests();
    setXLiveEnabledForTests(undefined);
    delete process.env.X_LIVE;
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_ACCESS_SECRET;
    delete process.env.X_ACCESS_TOKEN_SECRET;
  });

  afterEach(() => {
    resetTwitterClientForTests();
    setXLiveEnabledForTests(undefined);
    vi.restoreAllMocks();
    delete process.env.MASTODON_ACCESS_TOKEN;
    delete process.env.MASTODON_INSTANCE_URL;
    delete process.env.X_LIVE;
  });

  it("skips syndication when no credentials are provided", async () => {
    setTwitterClientForTests(null);
    const result = await broadcastOracleResolution("Test post", "0x123");
    expect(result).toEqual({
      x: "skipped",
      mastodon: "skipped",
    });
  });

  it("posts to X and Mastodon when configured and truncates X if needed", async () => {
    setXLiveEnabledForTests(true);
    let tweetedText = "";
    setTwitterClientForTests({
      v2: {
        tweet: async ({ text }) => {
          tweetedText = text;
          return { data: { id: "tweet-123" } };
        },
      },
    });

    process.env.MASTODON_ACCESS_TOKEN = "masto-token";
    process.env.MASTODON_INSTANCE_URL = "https://mastodon.test";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "masto-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const longPost = "A".repeat(300);
    const result = await broadcastOracleResolution(longPost, "0xabc");

    expect(result).toEqual({
      x: "posted",
      mastodon: "posted",
    });

    // X post truncated to 275 chars with "..."
    expect(tweetedText.length).toBe(275);
    expect(tweetedText.endsWith("...")).toBe(true);

    // Mastodon receives full text with idempotency key
    expect(fetchMock).toHaveBeenCalledWith(
      "https://mastodon.test/api/v1/statuses",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer masto-token",
          "Idempotency-Key": "oracle-resolve-0xabc",
        }),
      }),
    );
  });

  it("does not call X when credentials exist but X_LIVE is not exactly true", async () => {
    process.env.X_API_KEY = "key";
    process.env.X_API_SECRET = "secret";
    process.env.X_ACCESS_TOKEN = "token";
    process.env.X_ACCESS_TOKEN_SECRET = "token-secret";
    process.env.X_LIVE = "TRUE";

    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await broadcastOracleResolution("Oracle dry run", "0xdry");

    expect(result.x).toBe("posted");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("X_LIVE is not true"),
      expect.objectContaining({ textLength: expect.any(Number) }),
    );
  });

  it("handles provider failure gracefully without throwing", async () => {
    setXLiveEnabledForTests(true);
    setTwitterClientForTests({
      v2: {
        tweet: async () => {
          throw new Error("Rate limit exceeded");
        },
      },
    });

    process.env.MASTODON_ACCESS_TOKEN = "masto-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const result = await broadcastOracleResolution("Test failure", "0xerr");
    expect(result).toEqual({
      x: "failed",
      mastodon: "failed",
    });
  });
});
