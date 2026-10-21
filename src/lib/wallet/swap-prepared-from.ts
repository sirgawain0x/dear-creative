import { getAddress, type Address } from "viem";

export function attachFromToPrepared<T extends Record<string, unknown> | unknown[]>(
  prepared: T,
  from: Address,
): T {
  if (Array.isArray(prepared)) {
    return prepared.map((item) =>
      item && typeof item === "object"
        ? { ...(item as Record<string, unknown>), from }
        : item,
    ) as T;
  }
  return { ...prepared, from };
}

export function stripInternalPreparedFields(
  prepared: Record<string, unknown>,
): Record<string, unknown> {
  const { _swapQuoteSeal, ...rest } = prepared;
  return rest;
}
