import { getAddress, type Address } from "viem";
import { resolveAdminWalletConfig } from "./admin-wallet-address";
import { alchemyWalletJsonRpc } from "./alchemy-wallet-jsonrpc";
import { assertPreparedSwapAllowlisted } from "./swap-allowlist";
import {
  BASE_CHAIN_ID_HEX,
  swapTokenAddress,
  type SwapDirection,
} from "./swap-constants";
import { isAdminWalletDelegatedToMav2 } from "./swap-delegation";
import { WALLET_SWAP_ALLOWLIST_ERROR, WALLET_SWAP_FIXED_ERROR } from "./swap-errors";
import { isSwapQuoteSealConfigured, sealSwapQuote } from "./swap-quote-seal";
import { attachFromToPrepared } from "./swap-prepared-from";
import {
  toHexQuantity,
  validateSwapRequestInput,
  type SwapValidationSuccess,
} from "./swap-validation";

export type AlchemySwapQuoteResult = Record<string, unknown> | unknown[];

export type AdminSwapQuoteResponse = {
  from: Address;
  direction: SwapDirection;
  amount: string;
  slippageBps: number;
  chainId: number;
  needsWalletUpgrade: boolean;
  quoteSeal: string | null;
  quote: {
    expiry: string;
    minimumToAmount: string;
    fromAmount: string;
  };
  prepared: Record<string, unknown> | unknown[];
};

function formatAmount(direction: SwapDirection, amountRaw: bigint): string {
  if (direction === "USDC_TO_ETH") {
    return (Number(amountRaw) / 1e6).toString();
  }
  return (Number(amountRaw) / 1e18).toString();
}

export async function requestAdminSwapQuote(input: {
  direction: SwapDirection;
  amount: string;
  slippageBps?: number;
}): Promise<
  | { ok: true; quote: AdminSwapQuoteResponse }
  | { ok: false; status: number; error: string; field?: string }
> {
  const config = resolveAdminWalletConfig();
  if (!config.configured) {
    return { ok: false, status: 400, error: "Admin wallet is not configured." };
  }

  const validated = await validateSwapRequestInput({
    direction: input.direction,
    amount: input.amount,
    slippageBps: input.slippageBps,
  });
  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      error: validated.error,
      field: validated.field,
    };
  }

  if (!isSwapQuoteSealConfigured()) {
    return { ok: false, status: 502, error: WALLET_SWAP_FIXED_ERROR };
  }

  const v = validated as SwapValidationSuccess;
  const fromToken = swapTokenAddress(v.direction === "USDC_TO_ETH" ? "USDC" : "ETH");
  const toToken = swapTokenAddress(v.direction === "USDC_TO_ETH" ? "ETH" : "USDC");

  const policyId = process.env.ALCHEMY_SWAP_POLICY_ID?.trim();
  const capabilities: Record<string, unknown> = {
    eip7702Auth: {
      delegation: "ModularAccountV2",
      version: "v1.1.0",
    },
  };
  if (policyId) {
    capabilities.paymasterService = { policyId };
  }

  const params: Record<string, unknown> = {
    from: config.address,
    chainId: BASE_CHAIN_ID_HEX,
    fromToken,
    toToken,
    fromAmount: toHexQuantity(v.amountRaw),
    minimumToAmount: toHexQuantity(v.minimumToAmountRaw),
    capabilities,
  };

  const prepared = await alchemyWalletJsonRpc<AlchemySwapQuoteResult>(
    "wallet_requestQuote_v0",
    [params],
  );

  const allow = assertPreparedSwapAllowlisted(prepared, config.address);
  if (!allow.ok) {
    return { ok: false, status: 502, error: WALLET_SWAP_ALLOWLIST_ERROR };
  }

  const quoteSource = Array.isArray(prepared)
    ? (prepared.find(
        (item) =>
          item &&
          typeof item === "object" &&
          "quote" in (item as Record<string, unknown>),
      ) as Record<string, unknown> | undefined)
    : (prepared as Record<string, unknown>);

  const quoteObj = quoteSource?.quote as Record<string, string> | undefined;
  if (!quoteObj?.expiry || !quoteObj.minimumToAmount || !quoteObj.fromAmount) {
    return { ok: false, status: 502, error: "Unable to process wallet swap. Try again later." };
  }

  const needsWalletUpgrade = !(await isAdminWalletDelegatedToMav2(config.address));

  const preparedWithFrom = attachFromToPrepared(prepared, config.address);

  const quoteSeal = sealSwapQuote({
    from: getAddress(config.address),
    direction: v.direction,
    amount: formatAmount(v.direction, v.amountRaw),
    slippageBps: v.slippageBps,
    expiry: quoteObj.expiry,
    fromAmount: quoteObj.fromAmount,
    minimumToAmount: quoteObj.minimumToAmount,
  });
  if (!quoteSeal) {
    return { ok: false, status: 502, error: WALLET_SWAP_FIXED_ERROR };
  }

  const preparedForClient = Array.isArray(preparedWithFrom)
    ? preparedWithFrom.map((item) =>
        item && typeof item === "object" && "quote" in (item as Record<string, unknown>)
          ? { ...(item as Record<string, unknown>), _swapQuoteSeal: quoteSeal }
          : item,
      )
    : {
        ...(preparedWithFrom as Record<string, unknown>),
        _swapQuoteSeal: quoteSeal,
      };

  return {
    ok: true,
    quote: {
      from: getAddress(config.address),
      direction: v.direction,
      amount: formatAmount(v.direction, v.amountRaw),
      slippageBps: v.slippageBps,
      chainId: 8453,
      needsWalletUpgrade,
      quoteSeal,
      quote: {
        expiry: quoteObj.expiry,
        minimumToAmount: quoteObj.minimumToAmount,
        fromAmount: quoteObj.fromAmount,
      },
      prepared: preparedForClient,
    },
  };
}
