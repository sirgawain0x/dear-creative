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

/** Documented Alchemy smart-account + swap infrastructure targets on Base. */
/** Lowercase hex allowlist entries (Alchemy MAv2 deployments + swap tokens). */
export const SWAP_CALL_TARGET_ALLOWLIST: ReadonlySet<string> = new Set([
  SWAP_USDC.toLowerCase(),
  ALCHEMY_NATIVE_ETH_TOKEN.toLowerCase(),
  BASE_WETH_ADDRESS.toLowerCase(),
  ALCHEMY_MAV2_V110.toLowerCase(),
  ALCHEMY_MAV2_V100.toLowerCase(),
  ENTRY_POINT_V07.toLowerCase(),
  "0x0000000000008e6a39e03c7156e46b238c9e2036", // ExecutionInstallDelegate (MAv2)
  "0x00000000000002377b26b1eda7b0bc371c60dd4f", // ModularAccount impl
  "0x00000000000099de0bf6fa90deb851e2a2df7d83", // SingleSignerValidationModule
  "0x00000000000017c61b5bee81050ec8efc9c6fecd", // AccountFactory
]);
