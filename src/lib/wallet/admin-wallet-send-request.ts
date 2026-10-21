import { resolveAdminWalletConfig } from "./admin-wallet-address";
import { fetchWalletBalances } from "./balances";
import {
  isWalletReadFixtureEnabled,
  walletReadFixtureResponse,
} from "./asset-transfers";
import {
  buildAdminWalletSendCall,
  validateAdminWalletSendInput,
} from "./send-validation";
import { estimateAdminWalletSendGas } from "./send-gas-estimate";
import { isPrivyEmbeddedGasSponsorshipEnabled } from "./embedded-gas-sponsorship";

export const ADMIN_WALLET_SEND_VALIDATION_ERROR =
  "Unable to validate wallet send. Try again later.";

export type AdminWalletSendRequestBody = {
  recipient?: unknown;
  amount?: unknown;
};

export async function resolveAdminWalletSendValidation(
  body: AdminWalletSendRequestBody,
) {
  const config = resolveAdminWalletConfig();
  if (!config.configured) {
    return {
      ok: false as const,
      status: 400,
      error: "Admin wallet is not configured.",
    };
  }

  let balances: { usdcRaw: bigint };
  if (isWalletReadFixtureEnabled()) {
    walletReadFixtureResponse();
    balances = {
      usdcRaw: BigInt("1250500000"),
    };
  } else {
    const fetched = await fetchWalletBalances(config.address);
    balances = {
      usdcRaw: BigInt(fetched.usdc.raw),
    };
  }

  const validation = validateAdminWalletSendInput({
    recipient: typeof body.recipient === "string" ? body.recipient : "",
    amount: typeof body.amount === "string" ? body.amount : String(body.amount ?? ""),
    fromAddress: config.address,
    balances,
  });

  if (!validation.ok) {
    return {
      ok: false as const,
      status: 400,
      error: validation.error,
      field: validation.field,
    };
  }

  const call = buildAdminWalletSendCall(validation);
  const gas = await estimateAdminWalletSendGas(config.address, [call]);

  return {
    ok: true as const,
    fromAddress: config.address,
    validation,
    call,
    gas,
    chain: { network: "base", chainId: 8453 },
    gasSponsorshipAvailable: isPrivyEmbeddedGasSponsorshipEnabled(),
  };
}

export async function resolveAdminWalletSendValidationSafe(
  body: AdminWalletSendRequestBody,
) {
  try {
    return await resolveAdminWalletSendValidation(body);
  } catch {
    return {
      ok: false as const,
      status: 502 as const,
      error: ADMIN_WALLET_SEND_VALIDATION_ERROR,
    };
  }
}
