export const COINBASE_CHECKOUT_ORIGIN = "https://pay.coinbase.com";

export function coinbaseCheckoutUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin === COINBASE_CHECKOUT_ORIGIN && !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}
