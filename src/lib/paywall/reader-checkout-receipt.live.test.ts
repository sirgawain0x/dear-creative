import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, Hash } from "viem";
import { TransactionReceiptNotFoundError } from "viem";
import {
  resetReaderCheckoutReceiptReaderForTests,
  verifyReaderCheckoutTransfer,
} from "./reader-checkout-receipt";
import { BASE_CHAIN_ID } from "@/lib/payments/subscription-config";

const mockGetTransactionReceipt = vi.hoisted(() => vi.fn());

vi.mock("viem", async (importOriginal) => {
  const mod = await importOriginal<typeof import("viem")>();
  return {
    ...mod,
    createPublicClient: vi.fn(() => ({
      getTransactionReceipt: mockGetTransactionReceipt,
      getBlockNumber: vi.fn(),
    })),
  };
});

const PAYEE = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const PAYER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const TX =
  "0x2222222222222222222222222222222222222222222222222222222222222222" as Hash;

describe("verifyReaderCheckoutTransfer live RPC", () => {
  beforeEach(() => {
    resetReaderCheckoutReceiptReaderForTests();
    vi.stubEnv("ALCHEMY_API_KEY", "test-key");
    mockGetTransactionReceipt.mockReset();
  });

  afterEach(() => {
    resetReaderCheckoutReceiptReaderForTests();
    vi.unstubAllEnvs();
  });

  it("maps TransactionReceiptNotFoundError to tx_not_confirmed with retry hint", async () => {
    mockGetTransactionReceipt.mockRejectedValue(
      new TransactionReceiptNotFoundError({ hash: TX }),
    );

    await expect(
      verifyReaderCheckoutTransfer({
        txHash: TX,
        expectedRecipient: PAYEE,
        expectedAmountRaw: BigInt(8_000000),
        payerAddress: PAYER,
        chainId: BASE_CHAIN_ID,
      }),
    ).rejects.toMatchObject({
      code: "tx_not_confirmed",
      status: 409,
      retryAfterSeconds: 15,
      message: expect.stringContaining("Retry"),
    });
  });
});
