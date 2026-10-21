import { getAddress, type Address, type Hex } from "viem";
import { resolveAdminWalletConfig } from "./admin-wallet-address";
import { alchemyWalletJsonRpc } from "./alchemy-wallet-jsonrpc";
import { assertPreparedSwapAllowlisted } from "./swap-allowlist";
import {
  WALLET_SWAP_ALLOWLIST_ERROR,
  WALLET_SWAP_QUOTE_BINDING_ERROR,
  WALLET_SWAP_QUOTE_EXPIRED_ERROR,
} from "./swap-errors";
import { isQuoteNearOrPastExpiry } from "./swap-expiry";
import { stripInternalPreparedFields } from "./swap-prepared-from";
import { verifySwapQuoteSeal, type SwapQuoteSealPayload } from "./swap-quote-seal";

export type SwapSubmitInput = {
  prepared: Record<string, unknown> | unknown[];
  signature: `0x${string}`;
  authorizations?: unknown[];
  chainId?: number;
  quoteBinding?: SwapQuoteBinding;
};

export type SwapQuoteBinding = {
  direction: SwapQuoteSealPayload["direction"];
  amount: string;
  slippageBps: number;
};

export async function submitAdminSwapPreparedCall(
  input: SwapSubmitInput,
): Promise<
  | { ok: true; callId: string }
  | { ok: false; status: number; error: string }
> {
  const config = resolveAdminWalletConfig();
  if (!config.configured) {
    return { ok: false, status: 400, error: "Admin wallet is not configured." };
  }

  const allow = assertPreparedSwapAllowlisted(input.prepared, config.address);
  if (!allow.ok) {
    return { ok: false, status: 502, error: WALLET_SWAP_ALLOWLIST_ERROR };
  }

  const quotePayload = extractQuoteFields(input.prepared);
  if (!quotePayload) {
    return { ok: false, status: 400, error: WALLET_SWAP_QUOTE_BINDING_ERROR };
  }

  if (!assertPreparedFromAdmin(input.prepared, config.address)) {
    return { ok: false, status: 400, error: "Swap from address mismatch." };
  }

  const seal = extractQuoteSeal(input.prepared);
  if (!input.quoteBinding || !verifySwapQuoteSeal(seal, { ...input.quoteBinding, ...quotePayload, from: config.address })) {
    return { ok: false, status: 400, error: WALLET_SWAP_QUOTE_BINDING_ERROR };
  }

  if (isQuoteNearOrPastExpiry(quotePayload.expiry)) {
    return { ok: false, status: 409, error: WALLET_SWAP_QUOTE_EXPIRED_ERROR };
  }

  const chainId = input.chainId ?? 8453;
  const chainIdHex = `0x${chainId.toString(16)}`;

  const rpcParam = buildSendPreparedCallsPayload({
    prepared: input.prepared,
    signature: input.signature,
    authorizations: input.authorizations ?? [],
    chainIdHex,
  });

  const result = await alchemyWalletJsonRpc<{ id: string }>("wallet_sendPreparedCalls", [
    rpcParam,
  ]);

  if (!result?.id) {
    return {
      ok: false,
      status: 502,
      error: "Unable to process wallet swap. Try again later.",
    };
  }

  return { ok: true, callId: result.id };
}

function extractQuoteFields(
  prepared: Record<string, unknown> | unknown[],
): Omit<SwapQuoteSealPayload, "from" | "direction" | "amount" | "slippageBps"> | null {
  const record = Array.isArray(prepared)
    ? (prepared.find(
        (item) =>
          item &&
          typeof item === "object" &&
          "quote" in (item as Record<string, unknown>),
      ) as Record<string, unknown> | undefined)
    : prepared;

  const quote = record?.quote as
    | { expiry?: string; fromAmount?: string; minimumToAmount?: string }
    | undefined;
  if (!quote?.expiry || !quote.fromAmount || !quote.minimumToAmount) {
    return null;
  }
  return {
    expiry: quote.expiry,
    fromAmount: quote.fromAmount,
    minimumToAmount: quote.minimumToAmount,
  };
}

function extractQuoteSeal(prepared: Record<string, unknown> | unknown[]): unknown {
  if (Array.isArray(prepared)) {
    for (const item of prepared) {
      if (item && typeof item === "object" && "_swapQuoteSeal" in (item as Record<string, unknown>)) {
        return (item as Record<string, unknown>)._swapQuoteSeal;
      }
    }
    return null;
  }
  return prepared._swapQuoteSeal;
}

function buildSendPreparedCallsPayload(input: {
  prepared: Record<string, unknown> | unknown[];
  signature: Hex;
  authorizations: unknown[];
  chainIdHex: string;
}): unknown {
  if (Array.isArray(input.prepared)) {
    let authIndex = 0;
    return input.prepared.map((item) => {
      if (!item || typeof item !== "object") {
        return item;
      }
      const record = item as Record<string, unknown>;
      if (
        record.type === "authorization" ||
        record.type === "eip7702-authorization"
      ) {
        const signed = input.authorizations[authIndex];
        authIndex += 1;
        return signed ?? record;
      }
      const cleaned = stripInternalPreparedFields(record);
      return {
        ...cleaned,
        chainId: input.chainIdHex,
        signature: {
          type: "secp256k1",
          data: input.signature,
        },
      };
    });
  }

  const cleaned = stripInternalPreparedFields(input.prepared);
  return {
    ...cleaned,
    chainId: input.chainIdHex,
    signature: {
      type: "secp256k1",
      data: input.signature,
    },
    ...(input.authorizations.length > 0
      ? { authorizations: input.authorizations }
      : {}),
  };
}

export function assertPreparedFromAdmin(
  prepared: Record<string, unknown> | unknown[],
  admin: Address,
): boolean {
  const fromValues: unknown[] = [];
  if (Array.isArray(prepared)) {
    for (const item of prepared) {
      if (item && typeof item === "object" && "from" in (item as Record<string, unknown>)) {
        fromValues.push((item as Record<string, unknown>).from);
      }
    }
  } else {
    fromValues.push(prepared.from);
  }

  if (fromValues.length === 0) {
    return false;
  }

  for (const from of fromValues) {
    if (typeof from !== "string") {
      return false;
    }
    try {
      if (getAddress(from).toLowerCase() !== admin.toLowerCase()) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

export async function fetchAdminSwapCallStatus(callId: string): Promise<{
  status: number;
  receipts?: Array<{ transactionHash?: string }>;
}> {
  const result = await alchemyWalletJsonRpc<{
    status: number;
    receipts?: Array<{ transactionHash?: string }>;
  }>("wallet_getCallsStatus", [[callId]]);

  return {
    status: result.status,
    receipts: result.receipts,
  };
}
