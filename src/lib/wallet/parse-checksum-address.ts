import { getAddress, isAddress, type Address } from "viem";

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export type ParseChecksumAddressResult =
  | { ok: true; address: Address }
  | { ok: false; error: string };

/** Rejects mixed-case addresses that are not valid EIP-55; normalizes all-lower/all-upper. */
export function parseChecksumAddress(input: string): ParseChecksumAddressResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Recipient address is required." };
  }
  if (!HEX_ADDRESS.test(trimmed)) {
    return { ok: false, error: "Recipient must be a valid address." };
  }
  const body = trimmed.slice(2);
  const isAllLower = body === body.toLowerCase();
  const isAllUpper = body === body.toUpperCase();
  if (!isAllLower && !isAllUpper) {
    if (!isAddress(trimmed, { strict: true })) {
      return { ok: false, error: "Recipient must be a checksummed address." };
    }
  }
  try {
    return { ok: true, address: getAddress(trimmed) };
  } catch {
    return { ok: false, error: "Recipient must be a valid address." };
  }
}
