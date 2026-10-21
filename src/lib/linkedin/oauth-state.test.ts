import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLinkedInOAuthState,
  parseLinkedInOAuthState,
  validateLinkedInOAuthStateForUser,
} from "./oauth-state";
import { stubLinkedInOAuthEnv } from "./test-helpers";

const ADMIN_DID = "did:privy:admin-user";

describe("LinkedIn OAuth state", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("binds Privy DID, nonce, and expiry in signed state", () => {
    stubLinkedInOAuthEnv();
    const now = 1_700_000_000_000;
    const state = createLinkedInOAuthState(ADMIN_DID, now);
    const parsed = parseLinkedInOAuthState(state);
    expect(parsed?.privyUserId).toBe(ADMIN_DID);
    expect(parsed?.expiresAtMs).toBe(now + 15 * 60 * 1000);
    expect(parsed?.nonce).toMatch(/^[a-f0-9]{32}$/);
  });

  it("validates state for matching admin DID within TTL", () => {
    stubLinkedInOAuthEnv();
    const now = Date.now();
    const state = createLinkedInOAuthState(ADMIN_DID, now);
    expect(validateLinkedInOAuthStateForUser(state, ADMIN_DID, now + 1000)).toBe(
      true,
    );
  });

  it("rejects tampered, expired, or DID-mismatched state", () => {
    stubLinkedInOAuthEnv();
    const now = Date.now();
    const state = createLinkedInOAuthState(ADMIN_DID, now);
    expect(validateLinkedInOAuthStateForUser(`${state}x`, ADMIN_DID, now)).toBe(
      false,
    );
    expect(
      validateLinkedInOAuthStateForUser(state, ADMIN_DID, now + 16 * 60 * 1000),
    ).toBe(false);
    expect(
      validateLinkedInOAuthStateForUser(
        state,
        "did:privy:other",
        now + 1000,
      ),
    ).toBe(false);
  });
});
