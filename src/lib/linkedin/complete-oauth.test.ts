import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/db/schema";
import { completeLinkedInOAuth } from "./complete-oauth";
import { setLinkedInFetchForTests } from "./http";
import { createLinkedInOAuthState } from "./oauth-state";
import { loadLinkedInPersonalCredentials, setLinkedInDbForTests } from "./token-store";
import { memberSubToPersonUrn } from "./member-urn";
import { stubLinkedInOAuthEnv } from "./test-helpers";

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

  it("rejects invalid CSRF state", async () => {
    const state = createLinkedInOAuthState();
    const result = await completeLinkedInOAuth({
      code: "code",
      state,
      cookieState: "different",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_state" });
  });

  it("exchanges code, loads userinfo sub, and stores encrypted credentials", async () => {
    const state = createLinkedInOAuthState();
    setLinkedInFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes("accessToken")) {
        return new Response(
          JSON.stringify({
            access_token: "stored-access",
            expires_in: 3600,
            refresh_token: "stored-refresh",
          }),
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
    });
    expect(result).toEqual({ ok: true });

    const creds = await loadLinkedInPersonalCredentials();
    expect(creds?.memberSub).toBe("abc123");
    expect(creds?.authorUrn).toBe(memberSubToPersonUrn("abc123"));
    expect(creds?.accessToken).toBe("stored-access");
    expect(creds?.refreshToken).toBe("stored-refresh");
  });
});
