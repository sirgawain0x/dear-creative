import { getAddress, type Address } from "viem";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";

/** Modular Account v2 v1.1.0 (EIP-7702 delegation target). */
export const ALCHEMY_MAV2_V110 = getAddress(
  "0x77021100bD87b7008E5E1989d0eB38555d0d0000",
);

/** Modular Account v2 v1.0.0 SemiModularAccount7702. */
export const ALCHEMY_MAV2_V100 = getAddress(
  "0x69007702764179f14F51cdce752f4f775d74E139",
);

/** Alchemy / Wallet APIs native ETH token sentinel (swap docs feePayment). */
export const ALCHEMY_NATIVE_ETH_TOKEN =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as Address;

export const BASE_WETH_ADDRESS = getAddress(
  "0x4200000000000000000000000000000000000006",
);

/** ERC-4337 EntryPoint v0.7 (bundler user ops). */
export const ENTRY_POINT_V07 = getAddress(
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
);

export const BASE_CHAIN_ID = 8453;
export const BASE_CHAIN_ID_HEX = "0x2105";

export const SWAP_USDC = BASE_USDC_ADDRESS;
export const SWAP_ETH = ALCHEMY_NATIVE_ETH_TOKEN;

export function isNativeEthToken(address: string): boolean {
  return address.toLowerCase() === ALCHEMY_NATIVE_ETH_TOKEN.toLowerCase();
}

export const DEFAULT_SWAP_SLIPPAGE_BPS = 50;
export const MAX_SWAP_SLIPPAGE_BPS = 200;

/** Re-request quote when within this many seconds of expiry. */
export const SWAP_QUOTE_EXPIRY_BUFFER_SEC = 15;

export const SWAP_FIXED_ERROR =
  "Unable to process wallet swap. Try again later.";

export type SwapDirection = "USDC_TO_ETH" | "ETH_TO_USDC";

export function swapTokenAddress(asset: "USDC" | "ETH"): Address {
  return asset === "USDC" ? SWAP_USDC : ALCHEMY_NATIVE_ETH_TOKEN;
}

/**
 * Allowed `execute` / `executeBatch` targets for admin swaps (tokens + settlement routers on Base).
 * Sources: Base USDC/WETH, Alchemy Wallet swap settlement (same-chain swaps alpha).
 */
export const ALCHEMY_BASE_SWAP_SETTLEMENT = getAddress(
  "0x0000000000008e6a39e03c7156e46b238c9e2036",
);

export const SWAP_ALLOWED_EXECUTE_TARGETS: ReadonlySet<string> = new Set([
  SWAP_USDC.toLowerCase(),
  BASE_WETH_ADDRESS.toLowerCase(),
  ALCHEMY_BASE_SWAP_SETTLEMENT.toLowerCase(),
  ENTRY_POINT_V07.toLowerCase(),
]);

/** Inner calldata selectors permitted on allowlisted targets (ERC-20 + common swap entrypoints). */
export const SWAP_ALLOWED_INNER_SELECTORS: ReadonlySet<string> = new Set([
  "0x095ea7b3", // approve(address,uint256)
  "0xa9059cbb", // transfer(address,uint256)
  "0x23b872dd", // transferFrom(address,address,uint256)
  "0x3593564c", // execute(bytes,bytes[],uint256) — Universal Router style
  "0x414bf389", // exactInputSingle(...)
  "0x24856bc3", // execute(bytes32,bytes) — Alchemy settlement surface
]);
