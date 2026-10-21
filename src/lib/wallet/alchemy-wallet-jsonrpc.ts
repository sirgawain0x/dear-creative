import { ALCHEMY_API_KEY_ENV } from "./alchemy-base-rpc";

export type AlchemyJsonRpcError = {
  code: number;
  message: string;
};

let alchemyWalletRpcOverride:
  | ((method: string, params: unknown) => Promise<unknown>)
  | null
  | undefined;

export function setAlchemyWalletRpcForTests(
  fn: ((method: string, params: unknown) => Promise<unknown>) | null,
): void {
  alchemyWalletRpcOverride = fn;
}

export function resetAlchemyWalletRpcForTests(): void {
  alchemyWalletRpcOverride = undefined;
}

function alchemyWalletApiUrl(): string | null {
  const key = process.env[ALCHEMY_API_KEY_ENV]?.trim();
  if (!key) {
    return null;
  }
  return `https://api.g.alchemy.com/v2/${key}`;
}

export async function alchemyWalletJsonRpc<T = unknown>(
  method: string,
  params: unknown,
): Promise<T> {
  if (alchemyWalletRpcOverride !== undefined && alchemyWalletRpcOverride !== null) {
    return (await alchemyWalletRpcOverride(method, params)) as T;
  }

  const url = alchemyWalletApiUrl();
  if (!url) {
    throw new Error("Alchemy API key is not configured.");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  const json = (await res.json()) as {
    result?: T;
    error?: AlchemyJsonRpcError;
  };

  if (json.error) {
    throw new Error(json.error.message);
  }

  return json.result as T;
}
