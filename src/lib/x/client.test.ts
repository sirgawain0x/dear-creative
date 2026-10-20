import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getXClient,
  resetXClientForTests,
  setXFetchForTests,
} from "./client";
import type { FetchLike } from "./oauth2";
import { resetXCredentialsLogForTests } from "./credentials";
import { setXLiveEnabledForTests } from "./feature-flag";

describe("getXClient / OAuth2UserContextXClient", () => {
  beforeEach(() => {
    resetXClientForTests();
    resetXCredentialsLogForTests();
    setXLiveEnabledForTests(undefined);
    delete process.env.X_CLIENT_ID;
    delete process.env.X_CLIENT_SECRET;
    delete process.env.X_REFRESH_TOKEN;
    delete process.env.X_LIVE;
  });

  afterEach(() => {
    resetXClientForTests();
    resetXCredentialsLogForTests();
    setXLiveEnabledForTests(undefined);
    vi.restoreAllMocks();
  });

  it("returns null and logs when OAuth env vars are missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(getXClient()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("missing env X_CLIENT_ID"),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("X_CLIENT_SECRET"),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("X_REFRESH_TOKEN"),
    );
  });

  it("uses mock client when credentials exist but X_LIVE is not true", async () => {
    process.env.X_CLIENT_ID = "client-id";
    process.env.X_CLIENT_SECRET = "client-secret";
    process.env.X_REFRESH_TOKEN = "refresh-token";

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

  it("posts via POST /2/tweets with Bearer token after OAuth2 refresh", async () => {
    process.env.X_CLIENT_ID = "my-client-id";
    process.env.X_CLIENT_SECRET = "my-client-secret";
    process.env.X_REFRESH_TOKEN = "my-refresh-token";
    setXLiveEnabledForTests(true);

    let tweetPostCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url === "https://api.x.com/2/oauth2/token") {
        expect(init?.method).toBe("POST");
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe(
          `Basic ${Buffer.from("my-client-id:my-client-secret").toString("base64")}`,
        );
        expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
        const body = init?.body?.toString() ?? "";
        expect(body).toContain("grant_type=refresh_token");
        expect(body).toContain("refresh_token=my-refresh-token");
        return new Response(
          JSON.stringify({
            access_token: "access-token-abc",
            expires_in: 7200,
            token_type: "bearer",
          }),
          { status: 200 },
        );
      }
      if (url === "https://api.x.com/2/tweets") {
        tweetPostCount += 1;
        expect(init?.method).toBe("POST");
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer access-token-abc");
        expect(headers["Content-Type"]).toBe("application/json");
        if (tweetPostCount === 1) {
          expect(init?.body).toBe(JSON.stringify({ text: "Read now" }));
        }
        return new Response(
          JSON.stringify({
            data: { id: `1844674407370955161${tweetPostCount}` },
          }),
          { status: 201 },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    setXFetchForTests(fetchMock as FetchLike);

    const client = getXClient();
    const result = await client!.postTweet({ text: "Read now" });

    expect(result).toEqual({ tweetId: "18446744073709551611" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await client!.postTweet({ text: "Second" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://api.x.com/2/tweets");
  });

  it("surfaces 401 from create post", async () => {
    process.env.X_CLIENT_ID = "id";
    process.env.X_CLIENT_SECRET = "secret";
    process.env.X_REFRESH_TOKEN = "refresh";
    setXLiveEnabledForTests(true);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "tok", expires_in: 7200 }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          errors: [{ message: "Unauthorized", code: 32 }],
        }),
        { status: 401 },
      );
    });
    setXFetchForTests(fetchMock as FetchLike);

    await expect(
      getXClient()!.postTweet({ text: "x" }),
    ).rejects.toThrow("Unauthorized");
  });

  it("surfaces 403 detail from create post", async () => {
    process.env.X_CLIENT_ID = "id";
    process.env.X_CLIENT_SECRET = "secret";
    process.env.X_REFRESH_TOKEN = "refresh";
    setXLiveEnabledForTests(true);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "tok", expires_in: 7200 }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          title: "Forbidden",
          detail: "You are not allowed to create a Tweet with duplicate content.",
          status: 403,
        }),
        { status: 403 },
      );
    });
    setXFetchForTests(fetchMock as FetchLike);

    await expect(getXClient()!.postTweet({ text: "dup" })).rejects.toThrow(
      "Forbidden: You are not allowed to create a Tweet with duplicate content.",
    );
  });

  it("surfaces 429 with rate-limit reset header", async () => {
    process.env.X_CLIENT_ID = "id";
    process.env.X_CLIENT_SECRET = "secret";
    process.env.X_REFRESH_TOKEN = "refresh";
    setXLiveEnabledForTests(true);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "tok", expires_in: 7200 }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          errors: [{ code: 88, message: "Rate limit exceeded" }],
        }),
        {
          status: 429,
          headers: { "x-rate-limit-reset": "1705420800" },
        },
      );
    });
    setXFetchForTests(fetchMock as FetchLike);

    await expect(getXClient()!.postTweet({ text: "busy" })).rejects.toThrow(
      "Rate limit exceeded; x-rate-limit-reset=1705420800",
    );
  });
});
