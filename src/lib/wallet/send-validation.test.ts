import { getAddress } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAdminWalletSendCall,
  validateAdminWalletSendInput,
} from "./send-validation";

const FROM = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");
const RECIPIENT = getAddress("0x1111111111111111111111111111111111111111");
const BAD_CHECKSUM = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD";

describe("validateAdminWalletSendInput", () => {
  const base = {
    fromAddress: FROM,
    balances: {
      usdcRaw: BigInt(1_000_000_000),
    },
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects non-checksummed mixed-case recipient", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: BAD_CHECKSUM,
      amount: "1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("recipient");
    }
  });

  it("accepts all-lowercase recipient", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: RECIPIENT.toLowerCase(),
      amount: "1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects zero address", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: "0x0000000000000000000000000000000000000000",
      amount: "1",
    });
    expect(result.ok).toBe(false);
  });

  it("warns on self-send without blocking", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: FROM,
      amount: "1",
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
      amount: "2000",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects amount over WALLET_SEND_MAX_USDC default", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: RECIPIENT,
      amount: "101",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("100 USDC");
    }
  });

  it("respects WALLET_SEND_MAX_USDC override", () => {
    vi.stubEnv("WALLET_SEND_MAX_USDC", "50");
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: RECIPIENT,
      amount: "51",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid decimal format", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: RECIPIENT,
      amount: "1.1234567",
    });
    expect(result.ok).toBe(false);
  });

  it("parses USDC with 6 decimals", () => {
    const result = validateAdminWalletSendInput({
      ...base,
      recipient: RECIPIENT,
      amount: "0.000001",
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
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      return;
    }
    const call = buildAdminWalletSendCall(validated);
    expect(call.data.startsWith("0xa9059cbb")).toBe(true);
  });
});
