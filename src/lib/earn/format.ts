import { formatUnits } from "viem";

export function formatApyBps(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) {
    return "—";
  }
  if (!Number.isFinite(bps)) {
    return "—";
  }
  return `${formatUnits(BigInt(Math.trunc(bps)), 2)}%`;
}

export function formatTokenAmountFromRaw(
  raw: string,
  decimals: number,
): string {
  try {
    return formatUnits(BigInt(raw), decimals);
  } catch {
    return "—";
  }
}

export function computeEarnedYieldRaw(
  assetsInVault: bigint,
  totalDeposited: bigint,
  totalWithdrawn: bigint,
): bigint {
  const netContributions = totalDeposited - totalWithdrawn;
  return assetsInVault - netContributions;
}

export function formatUsdWhole(usd: number | null | undefined): string {
  if (usd === null || usd === undefined || !Number.isFinite(usd)) {
    return "—";
  }
  const whole = BigInt(Math.trunc(usd));
  return `$${whole.toLocaleString("en-US")}`;
}

export function isBaseUsdcVault(asset: {
  symbol?: string;
  caip2?: string;
}): boolean {
  const symbol = asset.symbol?.trim().toLowerCase();
  return asset.caip2 === "eip155:8453" && symbol === "usdc";
}
