import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/db/schema";
import { completeLinkedInOAuth } from "./complete-oauth";
import { setLinkedInFetchForTests } from "./http";
import { createLinkedInOAuthState } from "./oauth-state";
import { loadLinkedInPersonalCredentials, setLinkedInDbForTests } from "./token-store";
import { stubLinkedInOAuthEnv } from "./test-helpers";

const ADMIN_DID = "did:privy:admin-g2";

describe("completeLinkedInOAuth", () => {
  beforeEach(async () => {
    stubLinkedInOAuthEnv();
    const client = createClient({ url: ":memory:" });
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    setLinkedInDbForTests(db);
  });

  afterEach(() => {
    setLinkedInDbForTests(undefined);
    setLinkedInFetchForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("rejects without token exchange when session is missing", async () => {
    const state = createLinkedInOAuthState(ADMIN_DID);
    const result = await completeLinkedInOAuth({
      code: "code",
      state,
      cookieState: state,
      privyUserId: null,
      isPrivyAdmin: false,
    });
    expect(result).toEqual({ ok: false, reason: "session_missing" });
  });

  it("rejects non-admin without token exchange", async () => {
    const state = createLinkedInOAuthState(ADMIN_DID);
    const result = await completeLinkedInOAuth({
      code: "code",
      state,
      cookieState: state,
      privyUserId: ADMIN_DID,
      isPrivyAdmin: false,
    });
    expect(result).toEqual({ ok: false, reason: "not_admin" });
  });

  it("rejects DID mismatch without token exchange", async () => {
    const state = createLinkedInOAuthState(ADMIN_DID);
    const result = await completeLinkedInOAuth({
      code: "code",
      state,
      cookieState: state,
      privyUserId: "did:privy:other-admin",
      isPrivyAdmin: true,
    });
    expect(result).toEqual({ ok: false, reason: "did_mismatch" });
  });

  it("maps LinkedIn error params to stable reason codes", async () => {
    const result = await completeLinkedInOAuth({
      code: null,
      state: null,
      cookieState: undefined,
      oauthError: "user_cancelled_login",
      privyUserId: ADMIN_DID,
      isPrivyAdmin: true,
    });
    expect(result).toEqual({ ok: false, reason: "user_cancelled" });
  });

  it("exchanges code when admin session matches state DID", async () => {
    const state = createLinkedInOAuthState(ADMIN_DID);
    setLinkedInFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes("accessToken")) {
        return new Response(
          JSON.stringify({ access_token: "stored-access", expires_in: 3600 }),
          { status: 200 },
        );
      }
      if (url.includes("userinfo")) {
        return new Response(JSON.stringify({ sub: "abc123" }), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    });

    const result = await completeLinkedInOAuth({
      code: "oauth-code",
      state,
      cookieState: state,
      privyUserId: ADMIN_DID,
      isPrivyAdmin: true,
    });
    expect(result).toEqual({ ok: true, reason: "connected" });
    const creds = await loadLinkedInPersonalCredentials();
    expect(creds?.memberSub).toBe("abc123");
  });

  it("returns token_exchange_failed on exchange errors", async () => {
    const state = createLinkedInOAuthState(ADMIN_DID);
    setLinkedInFetchForTests(async () => new Response("nope", { status: 400 }));
    const result = await completeLinkedInOAuth({
      code: "bad-code",
      state,
      cookieState: state,
      privyUserId: ADMIN_DID,
      isPrivyAdmin: true,
    });
    expect(result).toEqual({ ok: false, reason: "token_exchange_failed" });
  });
});
