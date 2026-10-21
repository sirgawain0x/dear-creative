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
 * Allowed inner calldata selectors per MAv2 `execute` target (lowercase address keys).
 *
 * Router rows MUST come from a captured `wallet_requestQuote_v0` response on Base
 * (see `src/lib/wallet/fixtures/alchemy-swap-quote-*.json` and PR #93). Do not
 * add router addresses from docs or explorers without a live quote decode.
 */
export const SWAP_EXECUTE_TARGET_SELECTORS: Readonly<
  Record<string, readonly string[]>
> = {
  [SWAP_USDC.toLowerCase()]: [
    "0x095ea7b3", // approve(address,uint256)
    "0xa9059cbb", // transfer(address,uint256)
  ],
  [BASE_WETH_ADDRESS.toLowerCase()]: [
    "0x095ea7b3", // approve(address,uint256)
    "0xd0e30db0", // deposit()
    "0x2e1a7d4d", // withdraw(uint256)
  ],
};

/** Targets that may receive ERC-20 `approve` spenders (routers from captured quotes). */
export function swapAllowedRouterTargets(): ReadonlySet<string> {
  const tokenTargets = new Set([
    SWAP_USDC.toLowerCase(),
    BASE_WETH_ADDRESS.toLowerCase(),
  ]);
  const routers = new Set<string>();
  for (const target of Object.keys(SWAP_EXECUTE_TARGET_SELECTORS)) {
    if (!tokenTargets.has(target)) {
      routers.add(target);
    }
  }
  return routers;
}
