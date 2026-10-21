import { connection, NextResponse } from "next/server";
import { fetchWalletBalances } from "@/lib/wallet/balances";
import {
  isWalletReadFixtureEnabled,
  walletReadFixtureResponse,
} from "@/lib/wallet/asset-transfers";
import { READER_WALLET_CHAIN_ID } from "@/lib/wallet/reader-wallet-chain";
import { requireReaderWalletApi } from "@/lib/wallet/require-reader-wallet-api";

const READER_WALLET_CACHE_CONTROL = "private, no-store";

function readerWalletJson(body: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", READER_WALLET_CACHE_CONTROL);
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(request: Request) {
  await connection();

  const gate = await requireReaderWalletApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  const { address } = gate.ctx;

  if (isWalletReadFixtureEnabled()) {
    const fixture = walletReadFixtureResponse();
    return readerWalletJson({
      configured: true,
      address,
      network: "base",
      chainId: READER_WALLET_CHAIN_ID,
      balances: {
        eth: { raw: "42000000000000000", formatted: fixture.balances.eth },
        usdc: { raw: "1250500000", formatted: fixture.balances.usdc },
      },
      fixture: true,
    });
  }

  try {
    const balances = await fetchWalletBalances(address);
    return readerWalletJson({
      configured: true,
      address,
      network: "base",
      chainId: READER_WALLET_CHAIN_ID,
      balances,
    });
  } catch {
    console.error("[reader-wallet] wallet_balances_fetch_failed", {
      code: "wallet_balances_fetch_failed",
    });
    return readerWalletJson(
      { error: "balances_unavailable" },
      { status: 502 },
    );
  }
}
