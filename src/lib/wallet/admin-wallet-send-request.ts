import { resolveAdminWalletConfig } from "./admin-wallet-address";
import { fetchWalletBalances } from "./balances";
import {
  isWalletReadFixtureEnabled,
  walletReadFixtureResponse,
} from "./asset-transfers";
import {
  buildAdminWalletSendCalls,
  validateAdminWalletSendInput,
  type AdminWalletSendAsset,
} from "./send-validation";
import { estimateAdminWalletSendGas } from "./send-gas-estimate";

export type AdminWalletSendRequestBody = {
  recipient?: unknown;
  amount?: unknown;
  asset?: unknown;
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

  const asset = body.asset;
  if (asset !== "USDC" && asset !== "ETH") {
    return {
      ok: false as const,
      status: 400,
      error: "Asset must be USDC or ETH.",
      field: "asset" as const,
    };
  }

  let balances: { ethRaw: bigint; usdcRaw: bigint };
  if (isWalletReadFixtureEnabled()) {
    walletReadFixtureResponse();
    balances = {
      ethRaw: BigInt("42000000000000000"),
      usdcRaw: BigInt("1250500000"),
    };
  } else {
    const fetched = await fetchWalletBalances(config.address);
    balances = {
      ethRaw: BigInt(fetched.eth.raw),
      usdcRaw: BigInt(fetched.usdc.raw),
    };
  }

  const validation = validateAdminWalletSendInput({
    recipient: typeof body.recipient === "string" ? body.recipient : "",
    amount: typeof body.amount === "string" ? body.amount : String(body.amount ?? ""),
    asset: asset as AdminWalletSendAsset,
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

  const calls = buildAdminWalletSendCalls(validation);
  const gas = await estimateAdminWalletSendGas(config.address, calls);

  return {
    ok: true as const,
    fromAddress: config.address,
    validation,
    calls,
    gas,
    chain: { network: "base", chainId: 8453 },
  };
}
