import { getPrivyAppId, getPrivyAppSecret } from "@/lib/privy/config";
import { PRIVY_WALLET_API_BASE } from "./privy-earn-urls";
const DEFAULT_TIMEOUT_MS = 15_000;

export type PrivyEarnVaultAsset = {
  address: string;
  symbol: string;
  decimals: number;
};

export type PrivyEarnVaultDetails = {
  id: string;
  name: string;
  provider: "morpho" | "aave" | "veda";
  vault_address: string;
  asset: PrivyEarnVaultAsset;
  caip2: string;
  user_apy: number | null;
  app_apy: number | null;
  tvl_usd: number | null;
  available_liquidity_usd: number | null;
  admin_wallet_id: string;
  admin_wallet_address: string;
  total_rewards_apr?: number;
  available_fees?: string;
};

export type PrivyEarnVaultPosition = {
  asset: PrivyEarnVaultAsset;
  total_deposited: string;
  total_withdrawn: string;
  assets_in_vault: string;
  shares_in_vault: string;
};

export class PrivyEarnConfigError extends Error {
  readonly code = "privy_earn_not_configured" as const;
}

export class PrivyEarnRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function buildPrivyBasicAuthHeader(): { appId: string; authorization: string } {
  const appId = getPrivyAppId();
  const secret = getPrivyAppSecret();
  if (!appId || !secret) {
    throw new PrivyEarnConfigError("Privy app credentials are not configured");
  }
  const credentials = Buffer.from(`${appId}:${secret}`, "utf8").toString(
    "base64",
  );
  return { appId, authorization: `Basic ${credentials}` };
}

function safeLogContext(details: Record<string, unknown>): Record<string, unknown> {
  const forbidden = new Set([
    "authorization",
    "Authorization",
    "PRIVY_APP_SECRET",
    "secret",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (forbidden.has(key)) {
      continue;
    }
    if (typeof value === "string" && value.startsWith("Basic ")) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

function isPrivyEarnVaultDetailsPath(path: string): boolean {
  return /^\/earn\/ethereum\/vaults\/[^/?]+$/.test(path);
}

function vaultIdFromPrivyEarnVaultDetailsPath(path: string): string | undefined {
  const vaultDetailsMatch = path.match(/^\/earn\/ethereum\/vaults\/([^/?]+)/);
  if (!vaultDetailsMatch?.[1]) {
    return undefined;
  }
  return decodeURIComponent(vaultDetailsMatch[1]);
}

async function privyEarnFetch<T>(
  path: string,
  init?: { timeoutMs?: number },
): Promise<T> {
  const { appId, authorization } = buildPrivyBasicAuthHeader();
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${PRIVY_WALLET_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authorization,
        "privy-app-id": appId,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    console.error(
      "[privy-earn] request_failed",
      safeLogContext({
        path,
        code: "privy_earn_network_error",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    throw new PrivyEarnRequestError(
      "privy_earn_network_error",
      502,
      "Privy Earn request failed",
    );
  }

  if (response.status === 404 && isPrivyEarnVaultDetailsPath(path)) {
    const parsedUrl = new URL(url);
    const vaultId = vaultIdFromPrivyEarnVaultDetailsPath(path);
    console.error(
      "[privy-earn] vault_not_found",
      safeLogContext({
        host: parsedUrl.host,
        path: parsedUrl.pathname,
        vaultId,
        code: "earn_vault_not_found",
      }),
    );
    throw new PrivyEarnRequestError(
      "earn_vault_not_found",
      502,
      "Privy Earn vault not found",
    );
  }

  if (!response.ok) {
    console.error(
      "[privy-earn] upstream_error",
      safeLogContext({
        path,
        status: response.status,
        code: "privy_earn_upstream_error",
      }),
    );
    throw new PrivyEarnRequestError(
      "privy_earn_upstream_error",
      response.status >= 500 ? 502 : response.status,
      `Privy Earn upstream returned ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export async function fetchPrivyEarnVaultDetails(
  vaultId: string,
): Promise<PrivyEarnVaultDetails> {
  return privyEarnFetch<PrivyEarnVaultDetails>(
    `/earn/ethereum/vaults/${encodeURIComponent(vaultId)}`,
  );
}

export async function fetchPrivyEarnVaultPosition(
  walletId: string,
  vaultId: string,
): Promise<PrivyEarnVaultPosition> {
  const params = new URLSearchParams({ vault_id: vaultId });
  return privyEarnFetch<PrivyEarnVaultPosition>(
    `/wallets/${encodeURIComponent(walletId)}/earn/ethereum/vaults?${params.toString()}`,
  );
}

export async function fetchPrivyEarnVaultDetailsBatch(
  vaultIds: readonly string[],
): Promise<PrivyEarnVaultDetails[]> {
  return Promise.all(vaultIds.map((id) => fetchPrivyEarnVaultDetails(id)));
}
