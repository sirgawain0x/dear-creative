import {
  privyEarnDepositUrl,
  privyEarnWithdrawUrl,
} from "./privy-earn-urls";

export type EarnAuthorizationSignaturePayload = {
  version: 1;
  method: "POST";
  url: string;
  body: { vault_id: string; raw_amount: string };
  headers: {
    "privy-app-id": string;
    "privy-idempotency-key": string;
  };
};

function requirePublicPrivyAppId(): string {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not configured");
  }
  return appId;
}

export function buildEarnDepositAuthorizationPayload(input: {
  walletId: string;
  vaultId: string;
  rawAmount: string;
  idempotencyKey: string;
}): EarnAuthorizationSignaturePayload {
  return {
    version: 1,
    method: "POST",
    url: privyEarnDepositUrl(input.walletId),
    body: {
      vault_id: input.vaultId,
      raw_amount: input.rawAmount,
    },
    headers: {
      "privy-app-id": requirePublicPrivyAppId(),
      "privy-idempotency-key": input.idempotencyKey,
    },
  };
}

export function buildEarnWithdrawAuthorizationPayload(input: {
  walletId: string;
  vaultId: string;
  rawAmount: string;
  idempotencyKey: string;
}): EarnAuthorizationSignaturePayload {
  return {
    version: 1,
    method: "POST",
    url: privyEarnWithdrawUrl(input.walletId),
    body: {
      vault_id: input.vaultId,
      raw_amount: input.rawAmount,
    },
    headers: {
      "privy-app-id": requirePublicPrivyAppId(),
      "privy-idempotency-key": input.idempotencyKey,
    },
  };
}
