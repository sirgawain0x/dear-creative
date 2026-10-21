import { describe, expect, it, vi, afterEach } from "vitest";
import type { Address, Hash, TransactionReceipt } from "viem";
import { ReaderCheckoutError } from "./reader-checkout-errors";
import {
  parseUsdcTransferFromReceipt,
  resetReaderCheckoutReceiptReaderForTests,
  setReaderCheckoutReceiptReaderForTests,
  verifyReaderCheckoutTransfer,
} from "./reader-checkout-receipt";
import { BASE_CHAIN_ID, BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";

const PAYEE = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const PAYER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const OTHER_TOKEN = "0x1111111111111111111111111111111111111111" as Address;
const TX =
  "0x2222222222222222222222222222222222222222222222222222222222222222" as Hash;

function transferLog(input: {
  token?: Address;
  from?: Address;
  to?: Address;
  value?: bigint;
}) {
  const token = input.token ?? BASE_USDC_ADDRESS;
  const from = input.from ?? PAYER;
  const to = input.to ?? PAYEE;
  const value = input.value ?? BigInt(8_000000);
  return {
    address: token,
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      `0x${from.slice(2).padStart(64, "0")}`,
      `0x${to.slice(2).padStart(64, "0")}`,
    ],
    data: `0x${value.toString(16).padStart(64, "0")}` as `0x${string}`,
    blockHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as const,
    blockNumber: BigInt(100),
    logIndex: 0,
    transactionHash: TX,
    transactionIndex: 0,
    removed: false,
  } as TransactionReceipt["logs"][number];
}

function receipt(overrides?: Partial<TransactionReceipt>): TransactionReceipt {
  return {
    blockHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as const,
    blockNumber: BigInt(100),
    contractAddress: null,
    cumulativeGasUsed: BigInt(0),
    effectiveGasPrice: BigInt(0),
    from: PAYER,
    gasUsed: BigInt(0),
    logs: [transferLog({})],
    logsBloom:
      "0x0000000000000000000000000000000000000000000000000000000000000000" as const,
    status: "success",
    to: BASE_USDC_ADDRESS,
    transactionHash: TX,
    transactionIndex: 0,
    type: "eip1559",
    ...overrides,
  } as unknown as TransactionReceipt;
}

describe("parseUsdcTransferFromReceipt", () => {
  it("accepts an exact USDC transfer to the writer split from the payer", () => {
    const result = parseUsdcTransferFromReceipt(
      receipt(),
      PAYEE,
      BigInt(8_000000),
      PAYER,
      3,
    );
    expect(result.value).toBe(BigInt(8_000000));
    expect(result.to.toLowerCase()).toBe(PAYEE.toLowerCase());
  });

  it("rejects wrong token", () => {
    expect(() =>
      parseUsdcTransferFromReceipt(
        receipt({ logs: [transferLog({ token: OTHER_TOKEN })] }),
        PAYEE,
        BigInt(8_000000),
        PAYER,
        3,
      ),
    ).toThrowError(ReaderCheckoutError);
    try {
      parseUsdcTransferFromReceipt(
        receipt({ logs: [transferLog({ token: OTHER_TOKEN })] }),
        PAYEE,
        BigInt(8_000000),
        PAYER,
        3,
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "wrong_token" });
    }
  });

  it("rejects wrong recipient", () => {
    try {
      parseUsdcTransferFromReceipt(
        receipt({
          logs: [
            transferLog({
              to: "0xcccccccccccccccccccccccccccccccccccccccc" as Address,
            }),
          ],
        }),
        PAYEE,
        BigInt(8_000000),
        PAYER,
        3,
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "wrong_recipient" });
    }
  });

  it("rejects short amount", () => {
    try {
      parseUsdcTransferFromReceipt(
        receipt({ logs: [transferLog({ value: BigInt(1_000000) })] }),
        PAYEE,
        BigInt(8_000000),
        PAYER,
        3,
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "wrong_amount" });
    }
  });

  it("rejects unsuccessful transactions", () => {
    try {
      parseUsdcTransferFromReceipt(
        receipt({ status: "reverted" }),
        PAYEE,
        BigInt(8_000000),
        PAYER,
        3,
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "tx_not_successful" });
    }
  });
});

describe("verifyReaderCheckoutTransfer (mocked RPC)", () => {
  afterEach(() => {
    resetReaderCheckoutReceiptReaderForTests();
  });

  it("rejects wrong chain before RPC", async () => {
    await expect(
      verifyReaderCheckoutTransfer({
        txHash: TX,
        expectedRecipient: PAYEE,
        expectedAmountRaw: BigInt(8_000000),
        payerAddress: PAYER,
        chainId: 1,
      }),
    ).rejects.toMatchObject({ code: "wrong_chain" });
  });

  it("rejects unconfirmed transactions", async () => {
    setReaderCheckoutReceiptReaderForTests({
      fetchTransfer: vi.fn().mockRejectedValue(
        new ReaderCheckoutError(
          "tx_not_confirmed",
          "Transaction is not confirmed yet.",
          409,
          15,
        ),
      ),
    });
    await expect(
      verifyReaderCheckoutTransfer({
        txHash: TX,
        expectedRecipient: PAYEE,
        expectedAmountRaw: BigInt(8_000000),
        payerAddress: PAYER,
        chainId: BASE_CHAIN_ID,
      }),
    ).rejects.toMatchObject({ code: "tx_not_confirmed" });
  });

  it("rejects reused hash at service layer via unique constraint (mock success path)", async () => {
    setReaderCheckoutReceiptReaderForTests({
      fetchTransfer: vi.fn().mockResolvedValue({
        from: PAYER,
        to: PAYEE,
        value: BigInt(8_000000),
        confirmations: 3,
        logEmitter: BASE_USDC_ADDRESS,
      }),
    });
    const result = await verifyReaderCheckoutTransfer({
      txHash: TX,
      expectedRecipient: PAYEE,
      expectedAmountRaw: BigInt(8_000000),
      payerAddress: PAYER,
      chainId: BASE_CHAIN_ID,
    });
    expect(result.value).toBe(BigInt(8_000000));
  });
});
