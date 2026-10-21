import { ALCHEMY_API_KEY_ENV } from "./alchemy-base-rpc";

let ethUsdPriceOverride: (() => Promise<number>) | null | undefined;

export function setSwapEthUsdPriceForTests(fn: (() => Promise<number>) | null): void {
  ethUsdPriceOverride = fn;
}

export function resetSwapEthUsdPriceForTests(): void {
  ethUsdPriceOverride = undefined;
}

/** USD price of 1 ETH for notional cap checks (mockable in tests). */
export async function fetchEthUsdPrice(): Promise<number> {
  if (ethUsdPriceOverride !== undefined && ethUsdPriceOverride !== null) {
    return ethUsdPriceOverride();
  }

  const key = process.env[ALCHEMY_API_KEY_ENV]?.trim();
  if (!key) {
    throw new Error("Alchemy API key is not configured.");
  }

  const res = await fetch(
    `https://api.g.alchemy.com/prices/v1/${key}/tokens/by-symbol?symbols=ETH`,
  );
  if (!res.ok) {
    throw new Error("Price fetch failed.");
  }

  const json = (await res.json()) as {
    data?: Array<{ symbol?: string; prices?: Array<{ value?: string }> }>;
  };
  const eth = json.data?.find((row) => row.symbol === "ETH");
  const value = eth?.prices?.[0]?.value;
  const parsed = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Price fetch failed.");
  }
  return parsed;
}
