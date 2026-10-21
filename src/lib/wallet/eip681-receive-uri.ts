import { getAddress, type Address } from "viem";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";

/** Base mainnet — EIP-681 chain suffix for receive QR codes. */
export const BASE_RECEIVE_CHAIN_ID = 8453;

/** USDC on Base uses 6 decimal places; EIP-681 `uint256` is base units. */
export const BASE_USDC_RECEIVE_DECIMALS = 6;

export type BuildEip681BaseUsdcReceiveUriOptions = {
  /** Non-negative integer USDC amount in base units (6 decimals). */
  amountBaseUnits?: bigint | string | number;
};

function parseNonNegativeAmountBaseUnits(
  value: bigint | string | number,
): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error("amountBaseUnits must be a non-negative integer");
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      throw new Error("amountBaseUnits must be a non-negative integer");
    }
    return BigInt(value);
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("amountBaseUnits must be a non-negative integer");
  }
  return BigInt(trimmed);
}

/**
 * EIP-681 URI for receiving USDC on Base via ERC-20 transfer
 * (`ethereum:<USDC>@8453/transfer?address=<recipient>`).
 */
export function buildEip681BaseUsdcReceiveUri(
  rawRecipientAddress: string,
  options?: BuildEip681BaseUsdcReceiveUriOptions,
): string {
  const recipient: Address = getAddress(rawRecipientAddress);
  const usdcToken: Address = getAddress(BASE_USDC_ADDRESS);
  let uri = `ethereum:${usdcToken}@${BASE_RECEIVE_CHAIN_ID}/transfer?address=${recipient}`;
  if (options?.amountBaseUnits !== undefined) {
    const units = parseNonNegativeAmountBaseUnits(options.amountBaseUnits);
    uri += `&uint256=${units.toString()}`;
  }
  return uri;
}
