import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/db/schema";
import { LinkedInPostingDisabledError, LinkedInReauthRequiredError } from "./errors";
import {
  isLinkedInPostingEnabled,
  setLinkedInPostingEnabledForTests,
} from "./feature-flag";
import { setLinkedInFetchForTests } from "./http";
import { buildLinkedInTextPostBody, postToLinkedInPersonalProfile } from "./post";
import {
  saveLinkedInPersonalCredentials,
  setLinkedInDbForTests,
} from "./token-store";
import { stubLinkedInOAuthEnv } from "./test-helpers";

describe("LinkedIn Posts API", () => {
  beforeEach(async () => {
    stubLinkedInOAuthEnv();
    const client = createClient({ url: ":memory:" });
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    setLinkedInDbForTests(db);
  });

  afterEach(() => {
    setLinkedInDbForTests(undefined);
    setLinkedInPostingEnabledForTests(undefined);
    setLinkedInFetchForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("builds Posts API body for a personal author URN", () => {
    const body = buildLinkedInTextPostBody("urn:li:person:782bbtaQ", {
      commentary: "Hello LinkedIn",
    });
    expect(body).toMatchObject({
      author: "urn:li:person:782bbtaQ",
      commentary: "Hello LinkedIn",
      visibility: "PUBLIC",
      lifecycleState: "PUBLISHED",
    });
  });

  it("blocks posting when LINKEDIN_POSTING_ENABLED is off", async () => {
    vi.stubEnv("LINKEDIN_POSTING_ENABLED", "false");
    expect(isLinkedInPostingEnabled()).toBe(false);
    await expect(
      postToLinkedInPersonalProfile({ commentary: "nope" }),
    ).rejects.toBeInstanceOf(LinkedInPostingDisabledError);
  });

  it("posts with required REST headers and bearer token", async () => {
    setLinkedInPostingEnabledForTests(true);
    await saveLinkedInPersonalCredentials({
      memberSub: "782bbtaQ",
      accessToken: "live-access-token",
      expiresInSeconds: 3600,
      nowMs: 1_700_000_000_000,
    });

    setLinkedInFetchForTests(async (input, init) => {
      expect(String(input)).toBe("https://api.linkedin.com/rest/posts");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer live-access-token");
      expect(headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
      expect(headers["Linkedin-Version"]).toBe("202601");
      const payload = JSON.parse(String(init?.body));
      expect(payload.author).toBe("urn:li:person:782bbtaQ");
      expect(payload.commentary).toBe("Ship note");
      return new Response(null, {
        status: 201,
        headers: { "x-restli-id": "urn:li:share:123" },
      });
    });

    const result = await postToLinkedInPersonalProfile(
      { commentary: "Ship note" },
      1_700_000_000_000,
    );
    expect(result.postId).toBe("urn:li:share:123");
  });

  it("returns re-auth error when access token is expired", async () => {
    setLinkedInPostingEnabledForTests(true);
    const now = 1_700_000_000_000;
    await saveLinkedInPersonalCredentials({
      memberSub: "782bbtaQ",
      accessToken: "expired-token",
      expiresInSeconds: 60,
      nowMs: now - 120_000,
    });

    await expect(
      postToLinkedInPersonalProfile({ commentary: "late" }, now),
    ).rejects.toBeInstanceOf(LinkedInReauthRequiredError);
  });
});
