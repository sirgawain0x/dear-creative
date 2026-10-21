import { describe, expect, it } from "vitest";
import {
  assertReaderWalletChainId,
  READER_WALLET_CHAIN_ID,
  resolveReaderWalletGateChainId,
} from "./reader-wallet-chain";

describe("assertReaderWalletChainId", () => {
  it("allows Base mainnet (8453)", () => {
    expect(() => assertReaderWalletChainId(READER_WALLET_CHAIN_ID)).not.toThrow();
  });

  it("throws when chain id is not Base mainnet", () => {
    expect(() => assertReaderWalletChainId(1)).toThrow("reader_wallet_wrong_chain");
  });
});

describe("resolveReaderWalletGateChainId", () => {
  it("returns 8453 for the reader wallet gate", () => {
    expect(resolveReaderWalletGateChainId()).toBe(8453);
  });
});
