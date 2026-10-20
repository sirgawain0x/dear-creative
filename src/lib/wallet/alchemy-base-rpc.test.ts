import { afterEach, describe, expect, it, vi } from "vitest";
import { alchemyBaseMainnetRpcUrl } from "./alchemy-base-rpc";

describe("alchemyBaseMainnetRpcUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads only ALCHEMY_API_KEY (not other Alchemy env names)", () => {
    vi.stubEnv("ALCHEMY_API_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_ALCHEMY_API_KEY", "public-key");
    vi.stubEnv("ALCHEMY_BASE_API_KEY", "base-key");
    expect(alchemyBaseMainnetRpcUrl()).toBe(
      "https://base-mainnet.g.alchemy.com/v2/test-key",
    );
  });

  it("falls back to public Base RPC when ALCHEMY_API_KEY is unset", () => {
    vi.stubEnv("ALCHEMY_API_KEY", "");
    expect(alchemyBaseMainnetRpcUrl()).toBe("https://mainnet.base.org");
  });
});
