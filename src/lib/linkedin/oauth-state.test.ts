import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLinkedInOAuthState,
  validateLinkedInOAuthState,
} from "./oauth-state";
import { stubLinkedInOAuthEnv } from "./test-helpers";

describe("LinkedIn OAuth state", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates signed state within TTL", () => {
    stubLinkedInOAuthEnv();
    const now = 1_700_000_000_000;
    const state = createLinkedInOAuthState(now);
    expect(validateLinkedInOAuthState(state, now + 60_000)).toBe(true);
  });

  it("rejects tampered or expired state", () => {
    stubLinkedInOAuthEnv();
    const now = 1_700_000_000_000;
    const state = createLinkedInOAuthState(now);
    expect(validateLinkedInOAuthState(`${state}x`, now + 60_000)).toBe(false);
    expect(validateLinkedInOAuthState(state, now + 16 * 60 * 1000)).toBe(false);
    expect(validateLinkedInOAuthState(null, now)).toBe(false);
  });
});
