import { getAddress, isAddress, type Address } from "viem";
import { SWAP_CALL_TARGET_ALLOWLIST } from "./swap-constants";

const ADDRESS_IN_JSON = /0x[a-fA-F0-9]{40}/g;

function normalizeAddress(value: string): Address | null {
  if (!isAddress(value)) {
    return null;
  }
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

/** Collect `to` / delegation / token targets from an Alchemy prepared swap payload. */
export function collectSwapCallTargets(payload: unknown): Address[] {
  const found = new Set<string>();

  const visit = (node: unknown): void => {
    if (node === null || node === undefined) {
      return;
    }
    if (typeof node === "string") {
      const matches = node.match(ADDRESS_IN_JSON);
      if (matches) {
        for (const m of matches) {
          const addr = normalizeAddress(m);
          if (addr) {
            found.add(addr.toLowerCase());
          }
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }
    if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        if (
          key === "to" ||
          key === "target" ||
          key === "contractAddress" ||
          key === "tokenAddress" ||
          key === "address" ||
          key === "delegation" ||
          key === "fromToken" ||
          key === "toToken"
        ) {
          if (typeof value === "string") {
            const addr = normalizeAddress(value);
            if (addr) {
              found.add(addr.toLowerCase());
            }
          }
        }
        visit(value);
      }
    }
  };

  visit(payload);
  return [...found].map((a) => getAddress(a));
}

export function assertSwapCallTargetsAllowlisted(
  targets: Address[],
  adminAddress: Address,
): { ok: true } | { ok: false; disallowed: Address[] } {
  const allowed = new Set(SWAP_CALL_TARGET_ALLOWLIST);
  allowed.add(adminAddress.toLowerCase());

  const disallowed: Address[] = [];
  for (const target of targets) {
    if (!allowed.has(target.toLowerCase())) {
      disallowed.push(target);
    }
  }

  if (disallowed.length > 0) {
    return { ok: false, disallowed };
  }
  return { ok: true };
}
