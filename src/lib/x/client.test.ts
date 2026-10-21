import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getXClient,
  resetXClientForTests,
  setXFetchForTests,
} from "./client";
import { resetXCredentialsLogForTests } from "./credentials";
import type { FetchLike } from "./fetch-like";
import { setXLiveEnabledForTests } from "./feature-flag";
import {
  OAuth1UserContextXClient,
  setOAuth1SigningHooksForTests,
} from "./live-client";

const OAUTH1_CREDS = {
  X_API_KEY: "xvz1evFS4wEEPTGEFPHBog",
  X_API_SECRET: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
  X_ACCESS_TOKEN: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
  X_ACCESS_TOKEN_SECRET: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
};

function setOAuth1Env(): void {
  process.env.X_API_KEY = OAUTH1_CREDS.X_API_KEY;
  process.env.X_API_SECRET = OAUTH1_CREDS.X_API_SECRET;
  process.env.X_ACCESS_TOKEN = OAUTH1_CREDS.X_ACCESS_TOKEN;
  process.env.X_ACCESS_TOKEN_SECRET = OAUTH1_CREDS.X_ACCESS_TOKEN_SECRET;
}

describe("getXClient / OAuth1UserContextXClient", () => {
  beforeEach(() => {
    resetXClientForTests();
    resetXCredentialsLogForTests();
    setXLiveEnabledForTests(undefined);
    setOAuth1SigningHooksForTests(undefined);
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_ACCESS_TOKEN_SECRET;
    delete process.env.X_ACCESS_SECRET;
    delete process.env.X_LIVE;
  });

  afterEach(() => {
    resetXClientForTests();
    resetXCredentialsLogForTests();
    setXLiveEnabledForTests(undefined);
    setOAuth1SigningHooksForTests(undefined);
    vi.restoreAllMocks();
  });

  it("returns null and logs when OAuth 1.0a env vars are missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(getXClient()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("missing env X_API_KEY"),
    );
  });

  it("uses mock client when credentials exist but X_LIVE is not true", async () => {
    setOAuth1Env();

    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi.fn() as unknown as FetchLike;
    setXFetchForTests(fetchMock);

    const client = getXClient();
    expect(client).not.toBeNull();
    const result = await client!.postTweet({ text: "Hello" });

    expect(result.tweetId).toBe("mock-x-dry-run");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("X_LIVE is not true"),
      expect.any(Object),
    );
  });

  it("posts via POST /2/tweets with OAuth 1.0a Authorization header", async () => {
    setOAuth1Env();
    setXLiveEnabledForTests(true);
    setOAuth1SigningHooksForTests({
      nonce: () => "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
      timestamp: () => "1318622958",
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      expect(url).toBe("https://api.x.com/2/tweets");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers.Authorization).toMatch(/^OAuth /);
      expect(headers.Authorization).toContain('oauth_signature="');
      expect(headers.Authorization).toContain(
        'oauth_signature="lr%2BtV%2FDKclEvXKVjG6tgaSSLV0k%3D"',
      );
      expect(init?.body).toBe(JSON.stringify({ text: "Read now" }));
      return new Response(
        JSON.stringify({ data: { id: "18446744073709551611" } }),
        { status: 201 },
      );
    });
    setXFetchForTests(fetchMock as FetchLike);

    const client = getXClient();
    expect(client).toBeInstanceOf(OAuth1UserContextXClient);
    const result = await client!.postTweet({ text: "Read now" });

    expect(result).toEqual({ tweetId: "18446744073709551611" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces 401 from create post", async () => {
    setOAuth1Env();
    setXLiveEnabledForTests(true);

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          errors: [{ message: "Unauthorized", code: 32 }],
        }),
        { status: 401 },
      ),
    );
    setXFetchForTests(fetchMock as FetchLike);

    await expect(getXClient()!.postTweet({ text: "x" })).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("surfaces 403 detail from create post", async () => {
    setOAuth1Env();
    setXLiveEnabledForTests(true);

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          title: "Forbidden",
          detail: "You are not allowed to create a Tweet with duplicate content.",
          status: 403,
        }),
        { status: 403 },
      ),
    );
    setXFetchForTests(fetchMock as FetchLike);

    await expect(getXClient()!.postTweet({ text: "dup" })).rejects.toThrow(
      "Forbidden: You are not allowed to create a Tweet with duplicate content.",
    );
  });

  it("surfaces 429 with rate-limit reset header", async () => {
    setOAuth1Env();
    setXLiveEnabledForTests(true);

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          errors: [{ code: 88, message: "Rate limit exceeded" }],
        }),
        {
          status: 429,
          headers: { "x-rate-limit-reset": "1705420800" },
        },
      ),
    );
    setXFetchForTests(fetchMock as FetchLike);

    await expect(getXClient()!.postTweet({ text: "busy" })).rejects.toThrow(
      "Rate limit exceeded; x-rate-limit-reset=1705420800",
    );
  });
});
