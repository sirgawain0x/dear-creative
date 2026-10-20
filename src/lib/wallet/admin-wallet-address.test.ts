import { afterEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { resolveAdminWalletConfig } from "./admin-wallet-address";

describe("resolveAdminWalletConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns unset when env is missing", () => {
    vi.stubEnv("ADMIN_WALLET_ADDRESS", "");
    expect(resolveAdminWalletConfig()).toEqual({
      configured: false,
      reason: "unset",
    });
  });

  it("returns invalid for malformed addresses", () => {
    vi.stubEnv("ADMIN_WALLET_ADDRESS", "not-an-address");
    expect(resolveAdminWalletConfig()).toEqual({
      configured: false,
      reason: "invalid",
    });
  });

  it("checksum-normalizes valid addresses", () => {
    const lower = "0xae48b6db64772b9cc24e33a79c809896776a20f6";
    vi.stubEnv("ADMIN_WALLET_ADDRESS", lower);
    const config = resolveAdminWalletConfig();
    expect(config.configured).toBe(true);
    if (config.configured) {
      expect(config.address).toBe(getAddress(lower));
    }
  });
});
