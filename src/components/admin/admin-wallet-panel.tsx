"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuthSession } from "@/components/providers/app-providers";
import { adminPrivyAuthorizationHeaders } from "@/lib/admin/admin-api-auth";
import { buildEip681BaseUsdcReceiveUri } from "@/lib/wallet/eip681-receive-uri";
import { AdminWalletSendForm } from "./admin-wallet-send-form";
import { AdminWalletSendEmbeddedBridge } from "./admin-wallet-send-embedded-bridge";
import { AdminWalletSwapForm } from "./admin-wallet-swap-form";
import { AdminWalletSwapEmbeddedBridge } from "./admin-wallet-swap-embedded-bridge";
import {
  resolveWalletPanelLoadErrors,
  WALLET_HISTORY_ERROR_MESSAGE,
} from "./admin-wallet-panel-errors";

type WalletSummaryResponse =
  | {
      configured: false;
      reason: "unset" | "invalid";
      network: string;
      chainId: number;
    }
  | {
      configured: true;
      address: string;
      network: string;
      chainId: number;
      balances: {
        eth: { formatted: string };
        usdc: { formatted: string };
      };
    };

type HistoryResponse = {
  configured: boolean;
  reason?: "unset" | "invalid";
  transfers: Array<{
    id: string;
    direction: "in" | "out";
    asset: "ETH" | "USDC";
    value: string;
    hash: string;
    timestamp: string | null;
  }>;
  pagination?: {
    incomingPageKey: string | null;
    outgoingPageKey: string | null;
  };
};

export type AdminWalletPreviewData = {
  summary: Extract<WalletSummaryResponse, { configured: true }>;
  history: HistoryResponse;
};

type AdminWalletPanelProps = {
  walletEnabled: boolean;
  walletSendEnabled?: boolean;
  walletSwapEnabled?: boolean;
  isAdmin?: boolean;
  previewSendEnabled?: boolean;
  previewSwapEnabled?: boolean;
  previewData?: AdminWalletPreviewData;
};

export function AdminWalletPanel({
  walletEnabled,
  walletSendEnabled = false,
  walletSwapEnabled = false,
  isAdmin = false,
  previewSendEnabled = false,
  previewSwapEnabled = false,
  previewData,
}: AdminWalletPanelProps) {
  const {
    ready,
    isSignedIn,
    authenticated,
    getAccessToken,
    privyConfigured,
  } = useAuthSession();
  const [loading, setLoading] = useState(
    () => walletEnabled && !previewData,
  );
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WalletSummaryResponse | null>(
    previewData?.summary ?? null,
  );
  const [history, setHistory] = useState<HistoryResponse | null>(
    previewData?.history ?? null,
  );
  const [incomingPageKey, setIncomingPageKey] = useState<string | null>(null);
  const [outgoingPageKey, setOutgoingPageKey] = useState<string | null>(null);

  const fetchWalletFromApi = useCallback(async () => {
    if (!walletEnabled || previewData) {
      return;
    }
    setError(null);
    setHistoryError(null);
    try {
      const headers = await adminPrivyAuthorizationHeaders({
        privyConfigured,
        authenticated,
        getAccessToken,
      });
      if (!isSignedIn || !headers) {
        setError("Sign in to view wallet data.");
        return;
      }
      const [summaryRes, historyRes] = await Promise.all([
        fetch("/api/admin/wallet", { headers }),
        fetch("/api/admin/wallet/history", { headers }),
      ]);

      const loadErrors = resolveWalletPanelLoadErrors({
        summaryOk: summaryRes.ok,
        summaryStatus: summaryRes.status,
        historyOk: historyRes.ok,
        historyStatus: historyRes.status,
      });

      if (loadErrors.featureDisabled) {
        setError("Wallet feature is disabled.");
        return;
      }
      if (loadErrors.authError) {
        setError(loadErrors.authError);
        return;
      }

      if (summaryRes.ok) {
        const summaryJson = (await summaryRes.json()) as WalletSummaryResponse;
        setSummary(summaryJson);
      } else {
        setError(loadErrors.summaryError);
      }

      if (historyRes.ok) {
        const historyJson = (await historyRes.json()) as HistoryResponse;
        setHistory(historyJson);
        setIncomingPageKey(historyJson.pagination?.incomingPageKey ?? null);
        setOutgoingPageKey(historyJson.pagination?.outgoingPageKey ?? null);
      } else {
        setHistory(null);
        setHistoryError(loadErrors.historyError ?? WALLET_HISTORY_ERROR_MESSAGE);
      }
    } catch {
      setError("Failed to load wallet data.");
    } finally {
      setLoading(false);
    }
  }, [
    authenticated,
    getAccessToken,
    isSignedIn,
    previewData,
    privyConfigured,
    walletEnabled,
  ]);

  useEffect(() => {
    if (!ready || !walletEnabled || previewData) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await fetchWalletFromApi();
      if (cancelled) {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchWalletFromApi, previewData, ready, walletEnabled]);

  const receiveUri = useMemo(() => {
    if (!summary || !summary.configured) {
      return null;
    }
    return buildEip681BaseUsdcReceiveUri(summary.address);
  }, [summary]);

  const handleRefresh = () => {
    setLoading(true);
    void fetchWalletFromApi();
  };

  const loadMoreHistory = async () => {
    if (!walletEnabled || !summary?.configured) {
      return;
    }
    const headers = await adminPrivyAuthorizationHeaders({
      privyConfigured,
      authenticated,
      getAccessToken,
    });
    if (!headers) {
      return;
    }
    const params = new URLSearchParams();
    if (incomingPageKey) {
      params.set("incomingPageKey", incomingPageKey);
    }
    if (outgoingPageKey) {
      params.set("outgoingPageKey", outgoingPageKey);
    }
    const response = await fetch(
      `/api/admin/wallet/history?${params.toString()}`,
      { headers },
    );
    if (!response.ok) {
      return;
    }
    const json = (await response.json()) as HistoryResponse;
    setHistory((prev) => ({
      ...json,
      transfers: [
        ...(prev?.transfers ?? []),
        ...json.transfers.filter(
          (t) => !(prev?.transfers ?? []).some((p) => p.id === t.id),
        ),
      ],
    }));
    setIncomingPageKey(json.pagination?.incomingPageKey ?? null);
    setOutgoingPageKey(json.pagination?.outgoingPageKey ?? null);
  };

  if (!walletEnabled) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Owner wallet (read-only) is disabled. Set{" "}
        <code className="text-xs">WALLET_ENABLED=true</code> to enable.
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60"
      data-testid="admin-wallet-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Funds (Base, read-only)</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Balances and history for the configured owner address only.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || Boolean(previewData)}
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {loading && !summary ? (
        <p className="mt-4 text-sm text-zinc-500">Loading wallet…</p>
      ) : null}

      {summary && !summary.configured ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Not configured</p>
          <p className="mt-1 text-xs opacity-90">
            Set <code>ADMIN_WALLET_ADDRESS</code> to a checksummed Base address.
            {summary.reason === "invalid" ? " Current value is invalid." : null}
          </p>
        </div>
      ) : null}

      {summary && summary.configured ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                ETH balance
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {summary.balances.eth.formatted}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                USDC balance
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {summary.balances.usdc.formatted}
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Receive on Base
              </p>
              <code className="mt-2 block break-all text-xs font-mono text-emerald-700 dark:text-emerald-400">
                {summary.address}
              </code>
              {receiveUri ? (
                <div className="mt-3 inline-flex max-w-full flex-col items-start gap-2">
                  <span
                    className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                    data-testid="admin-wallet-receive-network-label"
                  >
                    USDC on Base only
                  </span>
                  <QRCodeSVG
                    value={receiveUri}
                    size={200}
                    level="M"
                    marginSize={1}
                    className="max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                    data-testid="admin-wallet-receive-qr"
                    title="QR code for Base receive address (EIP-681)"
                  />
                </div>
              ) : null}
            </div>
            <div className="min-w-0 space-y-3">
              {previewSendEnabled ? (
                <AdminWalletSendForm
                  walletAddress={summary.address}
                  balances={summary.balances}
                  chainId={summary.chainId}
                  network={summary.network}
                  isAdmin={true}
                  walletSendEnabled={true}
                  getAccessToken={getAccessToken}
                  privyConfigured={privyConfigured}
                  authenticated={authenticated}
                  previewMode
                />
              ) : (
                <AdminWalletSendEmbeddedBridge adminWalletAddress={summary.address}>
                  {(embeddedSend) => (
                    <AdminWalletSendForm
                      walletAddress={summary.address}
                      balances={summary.balances}
                      chainId={summary.chainId}
                      network={summary.network}
                      isAdmin={isAdmin}
                      walletSendEnabled={walletSendEnabled}
                      getAccessToken={getAccessToken}
                      privyConfigured={privyConfigured}
                      authenticated={authenticated}
                      embeddedSend={embeddedSend}
                    />
                  )}
                </AdminWalletSendEmbeddedBridge>
              )}
              {previewSwapEnabled ? (
                <AdminWalletSwapForm
                  walletAddress={summary.address}
                  isAdmin={true}
                  walletSwapEnabled={true}
                  getAccessToken={getAccessToken}
                  privyConfigured={privyConfigured}
                  authenticated={authenticated}
                  previewMode
                />
              ) : (
                <AdminWalletSwapEmbeddedBridge adminWalletAddress={summary.address}>
                  {(signer) => (
                    <AdminWalletSwapForm
                      walletAddress={summary.address}
                      isAdmin={isAdmin}
                      walletSwapEnabled={walletSwapEnabled}
                      getAccessToken={getAccessToken}
                      privyConfigured={privyConfigured}
                      authenticated={authenticated}
                      signPreparedSwap={signer?.signPreparedSwap}
                    />
                  )}
                </AdminWalletSwapEmbeddedBridge>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Recent activity
            </p>
            {historyError ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                {historyError}
              </p>
            ) : null}
            <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
              {(history?.transfers ?? []).map((tx) => (
                <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
                  <span
                    className={
                      tx.direction === "in"
                        ? "font-semibold text-emerald-700 dark:text-emerald-400"
                        : "font-semibold text-zinc-700 dark:text-zinc-300"
                    }
                  >
                    {tx.direction === "in" ? "Received" : "Sent"}{" "}
                    {tx.value} {tx.asset}
                  </span>
                  <a
                    className="font-mono text-[10px] text-zinc-500 underline"
                    href={`https://basescan.org/tx/${tx.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tx.hash.slice(0, 10)}…
                  </a>
                </li>
              ))}
            </ul>
            {(incomingPageKey || outgoingPageKey) && (
              <button
                type="button"
                onClick={() => void loadMoreHistory()}
                className="mt-3 text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
              >
                Load more
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
