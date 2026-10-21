import { getPrivyAppId, getPrivyAppSecret } from "@/lib/privy/config";
import { PrivyEarnConfigError, PrivyEarnRequestError } from "./privy-earn";
import { privyWalletActionUrl } from "./privy-earn-urls";

const DEFAULT_TIMEOUT_MS = 15_000;

export type PrivyEarnWalletAction = {
  id: string;
  wallet_id: string;
  type: string;
  status: "pending" | "succeeded" | "rejected" | "failed";
  vault_id?: string;
  raw_amount?: string;
  amount?: string;
  created_at?: string;
};

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

async function privyWalletApiFetch<T>(
  url: string,
  init: {
    method: "GET" | "POST";
    body?: unknown;
    authorizationSignature: string;
    idempotencyKey?: string;
    timeoutMs?: number;
  },
): Promise<T> {
  const { appId, authorization } = buildPrivyBasicAuthHeader();
  const headers: Record<string, string> = {
    Authorization: authorization,
    "privy-app-id": appId,
    Accept: "application/json",
    "privy-authorization-signature": init.authorizationSignature,
  };
  if (init.idempotencyKey) {
    headers["privy-idempotency-key"] = init.idempotencyKey;
  }
  if (init.method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    throw new PrivyEarnRequestError(
      "privy_earn_network_error",
      502,
      "Privy Earn request failed",
    );
  }

  if (!response.ok) {
    throw new PrivyEarnRequestError(
      "privy_earn_upstream_error",
      response.status >= 500 ? 502 : response.status,
      `Privy Earn upstream returned ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export async function postPrivyEarnDeposit(params: {
  walletId: string;
  body: { vault_id: string; raw_amount: string };
  authorizationSignature: string;
  idempotencyKey: string;
}): Promise<PrivyEarnWalletAction> {
  const url = `https://api.privy.io/api/v1/wallets/${encodeURIComponent(params.walletId)}/earn/ethereum/deposit`;
  return privyWalletApiFetch<PrivyEarnWalletAction>(url, {
    method: "POST",
    body: params.body,
    authorizationSignature: params.authorizationSignature,
    idempotencyKey: params.idempotencyKey,
  });
}

export async function postPrivyEarnWithdraw(params: {
  walletId: string;
  body: { vault_id: string; raw_amount: string };
  authorizationSignature: string;
  idempotencyKey: string;
}): Promise<PrivyEarnWalletAction> {
  const url = `https://api.privy.io/api/v1/wallets/${encodeURIComponent(params.walletId)}/earn/ethereum/withdraw`;
  return privyWalletApiFetch<PrivyEarnWalletAction>(url, {
    method: "POST",
    body: params.body,
    authorizationSignature: params.authorizationSignature,
    idempotencyKey: params.idempotencyKey,
  });
}

export async function fetchPrivyWalletAction(
  walletId: string,
  actionId: string,
): Promise<PrivyEarnWalletAction> {
  const url = privyWalletActionUrl(walletId, actionId);
  const { appId, authorization } = buildPrivyBasicAuthHeader();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authorization,
        "privy-app-id": appId,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch {
    throw new PrivyEarnRequestError(
      "privy_earn_network_error",
      502,
      "Privy wallet action fetch failed",
    );
  }
  if (!response.ok) {
    throw new PrivyEarnRequestError(
      "privy_earn_upstream_error",
      response.status >= 500 ? 502 : response.status,
      `Privy wallet action fetch returned ${response.status}`,
    );
  }
  return (await response.json()) as PrivyEarnWalletAction;
}
