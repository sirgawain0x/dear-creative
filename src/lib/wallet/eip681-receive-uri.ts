import { getAddress, type Address } from "viem";

/** Base mainnet — EIP-681 chain suffix for receive QR codes. */
export const BASE_RECEIVE_CHAIN_ID = 8453;

/**
 * EIP-681 payment URI for receiving on Base (`ethereum:<checksummed>@8453`).
 */
export function buildEip681BaseReceiveUri(rawAddress: string): string {
  const checksummed: Address = getAddress(rawAddress);
  return `ethereum:${checksummed}@${BASE_RECEIVE_CHAIN_ID}`;
}
