import { getAddress, type Address } from "viem";
import { resolveAdminWalletConfig } from "./admin-wallet-address";
import { alchemyWalletJsonRpc } from "./alchemy-wallet-jsonrpc";
import {
  assertSwapCallTargetsAllowlisted,
  collectSwapCallTargets,
} from "./swap-allowlist";
import {
  BASE_CHAIN_ID_HEX,
  swapTokenAddress,
  type SwapDirection,
} from "./swap-constants";
import { isAdminWalletDelegatedToMav2 } from "./swap-delegation";
import { WALLET_SWAP_ALLOWLIST_ERROR } from "./swap-errors";
import {
  toHexQuantity,
  validateSwapRequestInput,
  type SwapValidationSuccess,
} from "./swap-validation";

export type AlchemySwapQuoteResult = Record<string, unknown>;

export type AdminSwapQuoteResponse = {
  from: Address;
  direction: SwapDirection;
  amount: string;
  slippageBps: number;
  chainId: number;
  needsWalletUpgrade: boolean;
  quote: {
    expiry: string;
    minimumToAmount: string;
    fromAmount: string;
  };
  prepared: AlchemySwapQuoteResult;
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

  const v = validated as SwapValidationSuccess;
  const fromToken = swapTokenAddress(v.direction === "USDC_TO_ETH" ? "USDC" : "ETH");
  const toToken = swapTokenAddress(v.direction === "USDC_TO_ETH" ? "ETH" : "USDC");

  const policyId = process.env.ALCHEMY_SWAP_POLICY_ID?.trim();
  const params: Record<string, unknown> = {
    from: config.address,
    chainId: BASE_CHAIN_ID_HEX,
    fromToken,
    toToken,
    fromAmount: toHexQuantity(v.amountRaw),
    minimumToAmount: toHexQuantity(v.minimumToAmountRaw),
  };
  if (policyId) {
    params.capabilities = {
      paymasterService: { policyId },
      eip7702Auth: {
        delegation: "ModularAccountV2",
        version: "v1.1.0",
      },
    };
  }

  const prepared = await alchemyWalletJsonRpc<AlchemySwapQuoteResult>(
    "wallet_requestQuote_v0",
    [params],
  );

  const targets = collectSwapCallTargets(prepared);
  const allow = assertSwapCallTargetsAllowlisted(targets, config.address);
  if (!allow.ok) {
    return { ok: false, status: 502, error: WALLET_SWAP_ALLOWLIST_ERROR };
  }

  const quoteObj = prepared.quote as Record<string, string> | undefined;
  if (!quoteObj?.expiry || !quoteObj.minimumToAmount || !quoteObj.fromAmount) {
    return { ok: false, status: 502, error: "Unable to process wallet swap. Try again later." };
  }

  const needsWalletUpgrade = !(await isAdminWalletDelegatedToMav2(config.address));

  const preparedWithFrom = {
    ...prepared,
    from: config.address,
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
      quote: {
        expiry: quoteObj.expiry,
        minimumToAmount: quoteObj.minimumToAmount,
        fromAmount: quoteObj.fromAmount,
      },
      prepared: preparedWithFrom,
    },
  };
}

