import { getAddress } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashPreparedForSeal,
  hashSignatureRequestForSeal,
} from "./swap-prepared-digest";
import {
  resolveSwapQuoteSealSecret,
  sealSwapQuote,
  verifySwapQuoteSeal,
  WALLET_SWAP_QUOTE_SEAL_SECRET_ENV,
} from "./swap-quote-seal";
import {
  consumeSwapQuoteSealOnce,
  resetSwapQuoteSealReplayStoreForTests,
} from "./swap-quote-seal-replay";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

/** Test-only seal secret (32+ UTF-8 bytes). Never use in app config. */
const VALID_TEST_SEAL_SECRET = `vitest-only-${"x".repeat(32)}`;

const samplePrepared = {
  type: "user-operation-v070",
  signatureRequest: { type: "personal_sign", data: { raw: "0xabc" } },
  quote: { expiry: "2099-01-01T00:00:00.000Z", fromAmount: "0x1", minimumToAmount: "0x1" },
};

const samplePayload = {
  from: ADMIN,
  direction: "USDC_TO_ETH" as const,
  amount: "5",
  slippageBps: 50,
  expiry: "2099-01-01T00:00:00.000Z",
  fromAmount: "0x5f5e100",
  minimumToAmount: "0x4c4b400",
  chainId: 8453,
  preparedDigest: hashPreparedForSeal(samplePrepared),
  signatureRequestDigest: hashSignatureRequestForSeal(samplePrepared.signatureRequest),
};

describe("WALLET_SWAP_QUOTE_SEAL_SECRET", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetSwapQuoteSealReplayStoreForTests();
  });

  it("reads only WALLET_SWAP_QUOTE_SEAL_SECRET (not other env vars)", () => {
    vi.stubEnv(WALLET_SWAP_QUOTE_SEAL_SECRET_ENV, VALID_TEST_SEAL_SECRET);
    vi.stubEnv("ALCHEMY_API_KEY", "other-secret-should-not-be-used");
    expect(resolveSwapQuoteSealSecret().ok).toBe(true);
    vi.stubEnv(WALLET_SWAP_QUOTE_SEAL_SECRET_ENV, "");
    expect(resolveSwapQuoteSealSecret()).toEqual({ ok: false, reason: "unset" });
  });

  it("returns unset when the var is missing", () => {
    expect(resolveSwapQuoteSealSecret()).toEqual({ ok: false, reason: "unset" });
    expect(sealSwapQuote(samplePayload)).toBeNull();
  });

  it("returns too_short when fewer than 32 UTF-8 bytes", () => {
    vi.stubEnv(WALLET_SWAP_QUOTE_SEAL_SECRET_ENV, "a".repeat(31));
    expect(resolveSwapQuoteSealSecret()).toEqual({ ok: false, reason: "too_short" });
    expect(sealSwapQuote(samplePayload)).toBeNull();
  });

  it("seals and verifies when the secret is valid", () => {
    vi.stubEnv(WALLET_SWAP_QUOTE_SEAL_SECRET_ENV, VALID_TEST_SEAL_SECRET);
    const seal = sealSwapQuote(samplePayload);
    expect(seal).toBeTruthy();
    expect(verifySwapQuoteSeal(seal, samplePayload)).toBe(true);
    expect(verifySwapQuoteSeal(seal, { ...samplePayload, amount: "6" })).toBe(false);
  });

  it("rejects replayed seals within TTL", () => {
    vi.stubEnv(WALLET_SWAP_QUOTE_SEAL_SECRET_ENV, VALID_TEST_SEAL_SECRET);
    const seal = sealSwapQuote(samplePayload);
    expect(seal).toBeTruthy();
    expect(consumeSwapQuoteSealOnce(seal!)).toBe(true);
    expect(consumeSwapQuoteSealOnce(seal!)).toBe(false);
  });
});
