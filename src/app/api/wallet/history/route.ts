import { connection, NextResponse } from "next/server";
import {
  AlchemyTransfersError,
  isWalletReadFixtureEnabled,
  walletReadFixtureResponse,
} from "@/lib/wallet/asset-transfers";
import { READER_WALLET_CHAIN_ID } from "@/lib/wallet/reader-wallet-chain";
import { fetchReaderUsdcTransferHistory } from "@/lib/wallet/reader-wallet-history";
import { requireReaderWalletApi } from "@/lib/wallet/require-reader-wallet-api";

const DEFAULT_MAX_COUNT = 25;
const MAX_MAX_COUNT = 100;

const READER_WALLET_CACHE_CONTROL = "private, no-store";

function readerWalletJson(body: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", READER_WALLET_CACHE_CONTROL);
  return NextResponse.json(body, { ...init, headers });
}

function parseMaxCount(raw: string | null): number {
  if (!raw) {
    return DEFAULT_MAX_COUNT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_COUNT;
  }
  return Math.min(parsed, MAX_MAX_COUNT);
}

export async function GET(request: Request) {
  await connection();

  const gate = await requireReaderWalletApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  const { address } = gate.ctx;
  const url = new URL(request.url);
  const maxCount = parseMaxCount(url.searchParams.get("maxCount"));
  const incomingPageKey = url.searchParams.get("incomingPageKey") ?? undefined;
  const outgoingPageKey = url.searchParams.get("outgoingPageKey") ?? undefined;

  if (isWalletReadFixtureEnabled()) {
    const fixture = walletReadFixtureResponse();
    const usdcOnly = fixture.history.filter((row) => row.asset === "USDC");
    return readerWalletJson({
      configured: true,
      address,
      chainId: READER_WALLET_CHAIN_ID,
      network: "base",
      transfers: usdcOnly,
      pagination: {
        incomingPageKey: null,
        outgoingPageKey: null,
      },
      fixture: true,
    });
  }

  try {
    const { transfers, pagination } = await fetchReaderUsdcTransferHistory({
      wallet: address,
      maxCount,
      incomingPageKey,
      outgoingPageKey,
    });

    return readerWalletJson({
      configured: true,
      address,
      chainId: READER_WALLET_CHAIN_ID,
      network: "base",
      transfers,
      pagination,
    });
  } catch (error) {
    if (error instanceof AlchemyTransfersError) {
      return readerWalletJson(
        { error: "transfer_history_unavailable" },
        { status: 502 },
      );
    }
    return readerWalletJson(
      { error: "transfer_history_unavailable" },
      { status: 502 },
    );
  }
}
