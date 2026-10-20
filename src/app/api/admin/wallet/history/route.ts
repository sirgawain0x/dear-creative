import { NextResponse } from "next/server";
import { resolveAdminWalletConfig } from "@/lib/wallet/admin-wallet-address";
import {
  AlchemyTransfersError,
  fetchAlchemyAssetTransfersPage,
  isWalletReadFixtureEnabled,
  mergeWalletHistoryPages,
  normalizeTransferPage,
  walletReadFixtureResponse,
} from "@/lib/wallet/asset-transfers";
import { requireAdminWalletApi } from "@/lib/wallet/require-admin-wallet-api";

const DEFAULT_MAX_COUNT = 25;
const MAX_MAX_COUNT = 100;

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
  const gate = await requireAdminWalletApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  const config = resolveAdminWalletConfig();
  if (!config.configured) {
    return NextResponse.json({
      configured: false,
      reason: config.reason,
      transfers: [],
    });
  }

  const url = new URL(request.url);
  const maxCount = parseMaxCount(url.searchParams.get("maxCount"));
  const incomingPageKey = url.searchParams.get("incomingPageKey") ?? undefined;
  const outgoingPageKey = url.searchParams.get("outgoingPageKey") ?? undefined;

  if (isWalletReadFixtureEnabled()) {
    const fixture = walletReadFixtureResponse();
    return NextResponse.json({
      configured: true,
      address: config.address,
      transfers: fixture.history,
      pagination: {
        incomingPageKey: null,
        outgoingPageKey: null,
      },
      fixture: true,
    });
  }

  try {
    const [incomingResult, outgoingResult] = await Promise.all([
      fetchAlchemyAssetTransfersPage({
        wallet: config.address,
        direction: "in",
        maxCount,
        pageKey: incomingPageKey,
      }),
      fetchAlchemyAssetTransfersPage({
        wallet: config.address,
        direction: "out",
        maxCount,
        pageKey: outgoingPageKey,
      }),
    ]);

    const incoming = normalizeTransferPage(incomingResult, config.address, "in");
    const outgoing = normalizeTransferPage(
      outgoingResult,
      config.address,
      "out",
    );
    const transfers = mergeWalletHistoryPages(incoming.items, outgoing.items);

    return NextResponse.json({
      configured: true,
      address: config.address,
      transfers,
      pagination: {
        incomingPageKey: incoming.pageKey ?? null,
        outgoingPageKey: outgoing.pageKey ?? null,
      },
    });
  } catch (error) {
    if (error instanceof AlchemyTransfersError) {
      return NextResponse.json(
        {
          error: "transfer_history_unavailable",
          code: error.code,
          message: error.alchemyMessage,
        },
        { status: 502 },
      );
    }
    throw error;
  }
}
