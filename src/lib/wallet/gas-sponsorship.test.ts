import { afterEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import {
  getErc20GasConfig,
  resolveGasSponsorship,
  selfPaidDecision,
} from "./gas-sponsorship";

const OWNER = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");
const STRANGER = getAddress("0x1111111111111111111111111111111111111111");
const MEMBER = getAddress("0x2222222222222222222222222222222222222222");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("gas sponsorship policy", () => {
  it("sponsors nobody while the master switch is off", async () => {
    vi.stubEnv("PRIVY_EMBEDDED_GAS_SPONSORSHIP", "false");
    const decision = await resolveGasSponsorship({
      wallets: [OWNER],
      readMembership: async () => true,
    });
    expect(decision.mode).toBe("self_paid");
    expect(decision.reason).toBe("disabled");
  });

  it("sponsors an active Creator Pass holder", async () => {
    vi.stubEnv("PRIVY_EMBEDDED_GAS_SPONSORSHIP", "true");
    const decision = await resolveGasSponsorship({
      wallets: [STRANGER, OWNER],
      readMembership: async (wallet) =>
        wallet.toLowerCase() === OWNER.toLowerCase(),
    });
    expect(decision.mode).toBe("sponsored");
    expect(decision.reason).toBe("creator_pass");
    expect(decision.wallet?.toLowerCase()).toBe(OWNER.toLowerCase());
  });

  it("does not sponsor wallets without a pass", async () => {
    vi.stubEnv("PRIVY_EMBEDDED_GAS_SPONSORSHIP", "true");
    const decision = await resolveGasSponsorship({
      wallets: [MEMBER],
      readMembership: async () => false,
    });
    expect(decision).toEqual(selfPaidDecision("no_pass"));
  });

  it("treats signed-out viewers as self-paid", async () => {
    vi.stubEnv("PRIVY_EMBEDDED_GAS_SPONSORSHIP", "true");
    const decision = await resolveGasSponsorship({ wallets: [] });
    expect(decision.mode).toBe("self_paid");
    expect(decision.reason).toBe("signed_out");
  });

  it("fails closed when the membership read throws", async () => {
    vi.stubEnv("PRIVY_EMBEDDED_GAS_SPONSORSHIP", "true");
    const decision = await resolveGasSponsorship({
      wallets: [MEMBER],
      readMembership: async () => {
        throw new Error("rpc down");
      },
    });
    expect(decision.mode).toBe("self_paid");
    expect(decision.reason).toBe("no_pass");
  });

  it("ignores malformed wallet input", async () => {
    vi.stubEnv("PRIVY_EMBEDDED_GAS_SPONSORSHIP", "true");
    const decision = await resolveGasSponsorship({
      wallets: ["not-a-wallet"],
      readMembership: async () => true,
    });
    expect(decision.reason).toBe("signed_out");
  });

  it("exposes the ERC-20 USDC policy for self-paid sends", () => {
    vi.stubEnv("ALCHEMY_ERC20_GAS_POLICY_ID", "0200ae9b-ee40-48fb-9f36-1dda2fdde937");
    const config = getErc20GasConfig();
    expect(config.policyId).toBe("0200ae9b-ee40-48fb-9f36-1dda2fdde937");
    expect(config.chainId).toBe(8453);
    expect(config.tokenAddress.toLowerCase()).toBe(
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    );
    expect(config.tokenSymbol).toBe("USDC");
  });
});
