import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import {
  buildAdminWalletSendCalls,
  validateAdminWalletSendInput,
} from "./send-validation";

const FROM = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");
const RECIPIENT = getAddress("0x1111111111111111111111111111111111111111");
const BAD_CHECKSUM = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD";

describe("validateAdminWalletSendInput", () => {
  const base = {
    fromAddress: FROM,
    balances: {
      ethRaw: BigInt(10) ** BigInt(18),
      usdcRaw: BigInt(1_000_000),
    },
  };

  it("rejects non-checksummed recipient", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: BAD_CHECKSUM,
      amount: "1",
      asset: "USDC",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("recipient");
    }
  });

  it("rejects zero address", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: "0x0000000000000000000000000000000000000000",
      amount: "1",
      asset: "USDC",
    });
    expect(result.ok).toBe(false);
  });

  it("warns on self-send without blocking", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: FROM,
      amount: "1",
      asset: "USDC",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it("rejects amount over balance", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: RECIPIENT,
      amount: "2",
      asset: "USDC",
    });
    expect(result.ok).toBe(false);
  });

  it("parses USDC with 6 decimals", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: RECIPIENT,
      amount: "0.000001",
      asset: "USDC",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amountRaw).toBe(BigInt(1));
    }
  });

  it("builds USDC transfer call data", () => {
    const validated = validateAdminWalletSendInput({
      ...base,
      recipient: RECIPIENT,
      amount: "1",
      asset: "USDC",
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      return;
    }
    const calls = buildAdminWalletSendCalls(validated);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.data.startsWith("0xa9059cbb")).toBe(true);
  });
});
