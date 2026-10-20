import { getAddress } from "viem";

export function formatChecksumAddress(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return getAddress(trimmed);
  } catch {
    return null;
  }
}

export function basescanAddressUrl(address: string): string {
  return `https://basescan.org/address/${address}`;
}
