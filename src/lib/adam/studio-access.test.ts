import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CREATOR_PASS_LOCK_ADDRESS,
  evaluateStudioAccess,
  getCreatorPassLockAddress,
  getStudioAllowlistedWallets,
  getStudioMembershipAccessMode,
  isStudioAllowlistedWallet,
  normalizeWalletAddress,
  OWNER_STUDIO_WALLETS,
} from "./studio-access";

const OWNER = OWNER_STUDIO_WALLETS[0]!;
const STRANGER = "0x1111111111111111111111111111111111111111";
const MEMBER = "0x2222222222222222222222222222222222222222";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("studio access policy", () => {
  it("keeps the owner wallet on the allowlist by default", () => {
    vi.stubEnv("ADAM_STUDIO_ALLOWED_WALLETS", "");
    const allowlist = getStudioAllowlistedWallets();
    expect(allowlist.map((a) => a.toLowerCase())).toContain(
      OWNER.toLowerCase(),
    );
    expect(isStudioAllowlistedWallet(OWNER, allowlist)).toBe(true);
  });

  it("merges ADAM_STUDIO_ALLOWED_WALLETS, de-duplicating and skipping bad input", () => {
    vi.stubEnv(
      "ADAM_STUDIO_ALLOWED_WALLETS",
      `${STRANGER}, not-an-address, ${OWNER.toLowerCase()}`,
    );
    const allowlist = getStudioAllowlistedWallets();
    const lower = allowlist.map((a) => a.toLowerCase());
    expect(lower.filter((a) => a === OWNER.toLowerCase())).toHaveLength(1);
    expect(lower).toContain(STRANGER);
    expect(allowlist).toHaveLength(2);
  });

  it("normalizes only real addresses", () => {
    expect(normalizeWalletAddress("0xabc")).toBeNull();
    expect(normalizeWalletAddress("")).toBeNull();
    expect(normalizeWalletAddress(STRANGER)?.toLowerCase()).toBe(STRANGER);
  });

  it("member access is off unless ADAM_STUDIO_MEMBERSHIP_ACCESS says creator_pass", () => {
    vi.stubEnv("ADAM_STUDIO_MEMBERSHIP_ACCESS", "");
    expect(getStudioMembershipAccessMode()).toBe("off");
    vi.stubEnv("ADAM_STUDIO_MEMBERSHIP_ACCESS", "creator_pass");
    expect(getStudioMembershipAccessMode()).toBe("creator_pass");
    vi.stubEnv("ADAM_STUDIO_MEMBERSHIP_ACCESS", "members");
    expect(getStudioMembershipAccessMode()).toBe("creator_pass");
    vi.stubEnv("ADAM_STUDIO_MEMBERSHIP_ACCESS", "true");
    expect(getStudioMembershipAccessMode()).toBe("off");
  });

  it("defaults the lock to the Creative Creator Pass and honors the env override", () => {
    vi.stubEnv("CREATOR_PASS_LOCK_ADDRESS", "");
    expect(getCreatorPassLockAddress().toLowerCase()).toBe(
      CREATOR_PASS_LOCK_ADDRESS.toLowerCase(),
    );
    vi.stubEnv("CREATOR_PASS_LOCK_ADDRESS", STRANGER);
    expect(getCreatorPassLockAddress().toLowerCase()).toBe(STRANGER);
  });

  it("grants access to Privy admins without a wallet check", () => {
    const decision = evaluateStudioAccess({ isPrivyAdmin: true, wallets: [] });
    expect(decision).toEqual({ allowed: true, via: "owner", wallet: null });
  });

  it("grants access to an allowlisted wallet", () => {
    const decision = evaluateStudioAccess({
      isPrivyAdmin: false,
      wallets: [STRANGER, OWNER],
      allowlist: [OWNER],
    });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.via).toBe("allowlist");
      expect(decision.wallet?.toLowerCase()).toBe(OWNER.toLowerCase());
    }
  });

  it("denies signed-in users with no linked wallet", () => {
    expect(
      evaluateStudioAccess({ isPrivyAdmin: false, wallets: [], allowlist: [OWNER] }),
    ).toEqual({ allowed: false, reason: "no_linked_wallet" });
  });

  it("denies wallets that are neither allowlisted nor members", () => {
    expect(
      evaluateStudioAccess({
        isPrivyAdmin: false,
        wallets: [STRANGER],
        allowlist: [OWNER],
        membership: [{ address: STRANGER as `0x${string}`, hasValidKey: false }],
      }),
    ).toEqual({ allowed: false, reason: "not_a_member" });
  });

  it("grants access when a linked wallet holds a valid Creator Pass", () => {
    const decision = evaluateStudioAccess({
      isPrivyAdmin: false,
      wallets: [MEMBER],
      allowlist: [OWNER],
      membership: [{ address: MEMBER as `0x${string}`, hasValidKey: true }],
    });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.via).toBe("creator_pass");
      expect(decision.wallet?.toLowerCase()).toBe(MEMBER);
    }
  });
});
