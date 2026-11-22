import { afterEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { resolveAdamStudioAccess } from "./studio-access-server";

const OWNER = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");
const STRANGER = getAddress("0x1111111111111111111111111111111111111111");
const MEMBER = getAddress("0x2222222222222222222222222222222222222222");
const ADMIN_USER = "did:privy:admin-user";

afterEach(() => {
  vi.unstubAllEnvs();
});

function session(wallets: string[], privyUserId = "did:privy:stranger") {
  return { privyUserId, linkedWalletAddresses: wallets };
}

describe("resolveAdamStudioAccess", () => {
  it("denies a signed-out visitor", async () => {
    const result = await resolveAdamStudioAccess({ session: null });
    expect(result.decision).toEqual({ allowed: false, reason: "signed_out" });
    expect(result.membership.checked).toBe(false);
  });

  it("accepts a valid Studio Key without a Privy session", async () => {
    vi.stubEnv("ADAM_API_TOKEN", "studio-secret");

    const result = await resolveAdamStudioAccess({
      session: null,
      studioKey: "studio-secret",
    });

    expect(result.decision.allowed).toBe(true);
    if (result.decision.allowed) {
      expect(result.decision.via).toBe("studio_key");
    }
  });

  it("rejects a wrong Studio Key", async () => {
    vi.stubEnv("ADAM_API_TOKEN", "studio-secret");
    const result = await resolveAdamStudioAccess({
      session: null,
      studioKey: "wrong",
    });
    expect(result.decision.allowed).toBe(false);
  });

  it("lets the owner's allowlisted wallet in", async () => {
    const result = await resolveAdamStudioAccess({
      session: session([OWNER]),
      allowlist: [OWNER],
    });
    expect(result.decision.allowed).toBe(true);
    if (result.decision.allowed) {
      expect(result.decision.via).toBe("allowlist");
      expect(result.decision.wallet?.toLowerCase()).toBe(OWNER.toLowerCase());
    }
  });

  it("keeps other wallets out while membership access is off", async () => {
    const readMembership = vi.fn(async () => [
      { address: MEMBER, hasValidKey: true },
    ]);

    const result = await resolveAdamStudioAccess({
      session: session([MEMBER]),
      allowlist: [OWNER],
      membershipAccess: "off",
      readMembership,
    });

    expect(result.decision).toEqual({ allowed: false, reason: "not_a_member" });
    expect(readMembership).not.toHaveBeenCalled();
  });

  it("lets a pass holder in when membership access is on", async () => {
    const result = await resolveAdamStudioAccess({
      session: session([STRANGER, MEMBER]),
      allowlist: [OWNER],
      membershipAccess: "creator_pass",
      readMembership: async () => [
        { address: STRANGER, hasValidKey: false },
        { address: MEMBER, hasValidKey: true },
      ],
    });

    expect(result.decision.allowed).toBe(true);
    if (result.decision.allowed) {
      expect(result.decision.via).toBe("creator_pass");
      expect(result.decision.wallet?.toLowerCase()).toBe(MEMBER.toLowerCase());
    }
    expect(result.membership).toMatchObject({ checked: true, active: true });
  });

  it("denies and reports an inactive pass", async () => {
    const result = await resolveAdamStudioAccess({
      session: session([MEMBER]),
      allowlist: [OWNER],
      membershipAccess: "creator_pass",
      readMembership: async () => [{ address: MEMBER, hasValidKey: false }],
    });

    expect(result.decision.allowed).toBe(false);
    expect(result.membership).toMatchObject({ checked: true, active: false });
  });

  it("fails closed when the membership read throws", async () => {
    const result = await resolveAdamStudioAccess({
      session: session([MEMBER]),
      allowlist: [OWNER],
      membershipAccess: "creator_pass",
      readMembership: async () => {
        throw new Error("rpc down");
      },
    });

    expect(result.decision.allowed).toBe(false);
  });

  it("keeps the Privy admin allowlist as break-glass access", async () => {
    vi.stubEnv("PRIVY_ADMIN_USER_IDS", ADMIN_USER);

    const result = await resolveAdamStudioAccess({
      session: session([], ADMIN_USER),
      allowlist: [OWNER],
    });

    expect(result.decision.allowed).toBe(true);
    if (result.decision.allowed) {
      expect(result.decision.via).toBe("owner");
    }
  });
});
