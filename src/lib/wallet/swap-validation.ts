import { parseUnits } from "viem";
import { USDC_AMOUNT_REGEX } from "./send-validation";
import { getWalletSwapMaxUsdc } from "./swap-max-usdc";
import {
  DEFAULT_SWAP_SLIPPAGE_BPS,
  MAX_SWAP_SLIPPAGE_BPS,
  type SwapDirection,
} from "./swap-constants";
import { fetchEthUsdPrice } from "./swap-eth-usd-price";

export const ETH_AMOUNT_REGEX = /^\d+(\.\d{1,18})?$/;

export type SwapValidationInput = {
  direction: SwapDirection;
  amount: string;
  slippageBps?: number;
};

export type SwapValidationSuccess = {
  ok: true;
  direction: SwapDirection;
  amountRaw: bigint;
  slippageBps: number;
  notionalUsdcMicro: bigint;
  minimumToAmountRaw: bigint;
};

export type SwapValidationFailure = {
  ok: false;
  error: string;
  field?: "amount" | "direction" | "slippageBps";
};

export type SwapValidationResult = SwapValidationSuccess | SwapValidationFailure;

const BPS_DENOMINATOR = 10_000n;

function applySlippageMinimum(outputRaw: bigint, slippageBps: number): bigint {
  const bps = BigInt(slippageBps);
  return (outputRaw * (BPS_DENOMINATOR - bps)) / BPS_DENOMINATOR;
}

function usdcMicroFromEthRaw(ethRaw: bigint, ethUsdMicro: bigint): bigint {
  return (ethRaw * ethUsdMicro) / 10n ** 18n;
}

function ethWeiFromUsdcRaw(usdcRaw: bigint, ethUsdMicro: bigint): bigint {
  return (usdcRaw * 10n ** 18n) / ethUsdMicro;
}

export async function validateSwapRequestInput(
  input: SwapValidationInput,
): Promise<SwapValidationResult> {
  const slippageBps = input.slippageBps ?? DEFAULT_SWAP_SLIPPAGE_BPS;
  if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > MAX_SWAP_SLIPPAGE_BPS) {
    return {
      ok: false,
      error: `Slippage must be between 0.01% and ${MAX_SWAP_SLIPPAGE_BPS / 100}%.`,
      field: "slippageBps",
    };
  }

  const amountTrimmed = input.amount.trim();
  if (!amountTrimmed) {
    return { ok: false, error: "Amount is required.", field: "amount" };
  }

  let amountRaw: bigint;
  let notionalUsdcMicro: bigint;
  let minimumToAmountRaw: bigint;

  if (input.direction === "USDC_TO_ETH") {
    if (!USDC_AMOUNT_REGEX.test(amountTrimmed) || /^0+(\.0+)?$/.test(amountTrimmed)) {
      return {
        ok: false,
        error: "Enter a positive USDC amount (up to 6 decimal places).",
        field: "amount",
      };
    }
    try {
      amountRaw = parseUnits(amountTrimmed, 6);
    } catch {
      return { ok: false, error: "Invalid USDC amount.", field: "amount" };
    }
    notionalUsdcMicro = amountRaw;
    const ethUsd = await fetchEthUsdPrice();
    const ethUsdMicro = BigInt(Math.round(ethUsd * 1_000_000));
    const ethOutWei = ethWeiFromUsdcRaw(amountRaw, ethUsdMicro);
    minimumToAmountRaw = applySlippageMinimum(ethOutWei, slippageBps);
  } else {
    if (!ETH_AMOUNT_REGEX.test(amountTrimmed) || /^0+(\.0+)?$/.test(amountTrimmed)) {
      return {
        ok: false,
        error: "Enter a positive ETH amount (up to 18 decimal places).",
        field: "amount",
      };
    }
    try {
      amountRaw = parseUnits(amountTrimmed, 18);
    } catch {
      return { ok: false, error: "Invalid ETH amount.", field: "amount" };
    }
    const ethUsd = await fetchEthUsdPrice();
    const ethUsdMicro = BigInt(Math.round(ethUsd * 1_000_000));
    notionalUsdcMicro = usdcMicroFromEthRaw(amountRaw, ethUsdMicro);
    minimumToAmountRaw = applySlippageMinimum(notionalUsdcMicro, slippageBps);
  }

  const maxUsdc = getWalletSwapMaxUsdc();
  const maxRaw = parseUnits(String(maxUsdc), 6);
  if (notionalUsdcMicro > maxRaw) {
    return {
      ok: false,
      error: `Swap notional exceeds the ${maxUsdc} USDC limit.`,
      field: "amount",
    };
  }

  return {
    ok: true,
    direction: input.direction,
    amountRaw,
    slippageBps,
    notionalUsdcMicro,
    minimumToAmountRaw,
  };
}

export function toHexQuantity(value: bigint): string {
  return `0x${value.toString(16)}`;
}
