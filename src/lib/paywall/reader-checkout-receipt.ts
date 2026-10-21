import {
  createPublicClient,
  erc20Abi,
  getAddress,
  http,
  parseEventLogs,
  type Address,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { base } from "viem/chains";
import {
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
  SUBSCRIPTION_RPC_TIMEOUT_MS,
  subscriptionMinConfirmations,
} from "@/lib/payments/subscription-config";
import { ReaderCheckoutError } from "./reader-checkout-errors";

export type ReaderCheckoutTransfer = {
  from: Address;
  to: Address;
  value: bigint;
  confirmations: number;
  logEmitter: Address;
};

export type ReaderCheckoutReceiptReader = {
  fetchTransfer(input: {
    txHash: Hash;
    expectedRecipient: Address;
    expectedAmountRaw: bigint;
    payerAddress: Address;
    chainId: number;
  }): Promise<ReaderCheckoutTransfer>;
};

let receiptReaderOverride: ReaderCheckoutReceiptReader | null | undefined;

export function setReaderCheckoutReceiptReaderForTests(
  reader: ReaderCheckoutReceiptReader | null,
): void {
  receiptReaderOverride = reader;
}

export function resetReaderCheckoutReceiptReaderForTests(): void {
  receiptReaderOverride = undefined;
}

function alchemyRpcUrl(): string {
  const key = process.env.ALCHEMY_API_KEY?.trim() ?? "";
  return key
    ? `https://base-mainnet.g.alchemy.com/v2/${key}`
    : "https://mainnet.base.org";
}

function createBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http(alchemyRpcUrl(), {
      timeout: SUBSCRIPTION_RPC_TIMEOUT_MS,
    }),
  });
}

export function parseUsdcTransferFromReceipt(
  receipt: TransactionReceipt,
  expectedRecipient: Address,
  expectedAmountRaw: bigint,
  payerAddress: Address,
  confirmations: number,
): ReaderCheckoutTransfer {
  if (receipt.status !== "success") {
    throw new ReaderCheckoutError(
      "tx_not_successful",
      "Transaction did not succeed.",
      402,
    );
  }

  const logs = parseEventLogs({
    abi: erc20Abi,
    eventName: "Transfer",
    logs: receipt.logs,
  });

  const tokenNormalized = getAddress(BASE_USDC_ADDRESS).toLowerCase();
  const tokenLogs = logs.filter(
    (log) => getAddress(log.address).toLowerCase() === tokenNormalized,
  );

  if (tokenLogs.length === 0) {
    throw new ReaderCheckoutError(
      "wrong_token",
      "Payment must be USDC on Base.",
      402,
    );
  }

  const payeeNormalized = getAddress(expectedRecipient).toLowerCase();
  const payerNormalized = getAddress(payerAddress).toLowerCase();

  const matching = tokenLogs.filter(
    (log) =>
      getAddress(log.args.to).toLowerCase() === payeeNormalized &&
      getAddress(log.args.from).toLowerCase() === payerNormalized,
  );

  if (matching.length === 0) {
    const anyToPayee = tokenLogs.some(
      (log) => getAddress(log.args.to).toLowerCase() === payeeNormalized,
    );
    if (!anyToPayee) {
      throw new ReaderCheckoutError(
        "wrong_recipient",
        "Payment must go to the writer split address.",
        402,
      );
    }
    throw new ReaderCheckoutError(
      "payer_mismatch",
      "Payment must come from your linked wallet.",
      402,
    );
  }

  let totalValue = BigInt(0);
  for (const log of matching) {
    totalValue += log.args.value;
  }

  if (totalValue !== expectedAmountRaw) {
    throw new ReaderCheckoutError(
      "wrong_amount",
      "Payment amount does not match the quoted price.",
      402,
    );
  }

  const first = matching[0]!;
  return {
    from: getAddress(first.args.from),
    to: getAddress(first.args.to),
    value: totalValue,
    confirmations,
    logEmitter: getAddress(first.address),
  };
}

async function fetchTransferLive(input: {
  txHash: Hash;
  expectedRecipient: Address;
  expectedAmountRaw: bigint;
  payerAddress: Address;
  chainId: number;
}): Promise<ReaderCheckoutTransfer> {
  if (input.chainId !== BASE_CHAIN_ID) {
    throw new ReaderCheckoutError(
      "wrong_chain",
      "Payment must be on Base mainnet.",
      402,
    );
  }

  try {
    const client = createBaseClient();
    const receipt = await client.getTransactionReceipt({ hash: input.txHash });
    if (!receipt) {
      throw new ReaderCheckoutError(
        "tx_not_confirmed",
        "Transaction is not confirmed yet.",
        409,
        15,
      );
    }

    const head = await client.getBlockNumber();
    const confirmations = Number(head - receipt.blockNumber) + 1;
    const minConf = subscriptionMinConfirmations();
    if (confirmations < minConf) {
      throw new ReaderCheckoutError(
        "tx_not_confirmed",
        "Transaction is not confirmed yet.",
        409,
        15,
      );
    }

    return parseUsdcTransferFromReceipt(
      receipt,
      input.expectedRecipient,
      input.expectedAmountRaw,
      input.payerAddress,
      confirmations,
    );
  } catch (error) {
    if (error instanceof ReaderCheckoutError) {
      throw error;
    }
    throw new ReaderCheckoutError(
      "verification_unavailable",
      "Payment verification is temporarily unavailable.",
      503,
    );
  }
}

export async function verifyReaderCheckoutTransfer(input: {
  txHash: Hash;
  expectedRecipient: Address;
  expectedAmountRaw: bigint;
  payerAddress: Address;
  chainId: number;
}): Promise<ReaderCheckoutTransfer> {
  if (receiptReaderOverride !== undefined && receiptReaderOverride !== null) {
    return receiptReaderOverride.fetchTransfer(input);
  }
  return fetchTransferLive(input);
}

export function normalizeReaderCheckoutTxHash(txHash: string): Hash {
  const trimmed = txHash.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(trimmed)) {
    throw new ReaderCheckoutError(
      "invalid_tx_hash",
      "Transaction hash is invalid.",
      400,
    );
  }
  return trimmed as Hash;
}
