"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { adminPrivyAuthorizationHeaders } from "@/lib/admin/admin-api-auth";
import { buildEip681BaseUsdcReceiveUri } from "@/lib/wallet/eip681-receive-uri";
import { useAuthSession } from "@/components/providers/app-providers";

type WalletSummaryResponse =
  | {
      configured: false;
      reason?: string;
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
  transfers: Array<{
    id: string;
    direction: "in" | "out";
    asset: "USDC";
    value: string;
    hash: string;
    timestamp: string | null;
  }>;
};

export type ReaderWalletPreviewData = {
  summary: Extract<WalletSummaryResponse, { configured: true }>;
  history: HistoryResponse;
};

type ReaderWalletPanelProps = {
  previewData?: ReaderWalletPreviewData;
};

const BALANCES_ERROR = "Balances are temporarily unavailable.";
const HISTORY_ERROR = "Transfer history is temporarily unavailable.";
const SIGN_IN_ERROR = "Sign in with Privy to view your wallet.";
const WRONG_CHAIN_ERROR = "Wallet reads are limited to Base (chain 8453).";

export function ReaderWalletPanel({ previewData }: ReaderWalletPanelProps) {
  const {
    ready,
    authenticated,
    getAccessToken,
    privyConfigured,
  } = useAuthSession();

  const [loading, setLoading] = useState(() => !previewData);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WalletSummaryResponse | null>(
    previewData?.summary ?? null,
  );
  const [history, setHistory] = useState<HistoryResponse | null>(
    previewData?.history ?? null,
  );

  const fetchWallet = useCallback(async () => {
    if (previewData) {
      return;
    }

    try {
      const headers = await adminPrivyAuthorizationHeaders({
        privyConfigured,
        authenticated,
        getAccessToken,
      });
      if (!authenticated || !headers) {
        setError(SIGN_IN_ERROR);
        setSummary(null);
        setHistory(null);
        return;
      }

      const [summaryRes, historyRes] = await Promise.all([
        fetch("/api/wallet/me", { headers }),
        fetch("/api/wallet/history", { headers }),
      ]);

      if (summaryRes.status === 404 && !summaryRes.ok) {
        const body = (await summaryRes.json().catch(() => null)) as {
          reason?: string;
        } | null;
        if (body?.reason === "no_embedded_wallet") {
          setError("No Privy embedded wallet is linked to this account.");
          setSummary(null);
          setHistory(null);
          return;
        }
        setError("Reader wallet is not available.");
        return;
      }

      if (summaryRes.status === 401) {
        setError(SIGN_IN_ERROR);
        return;
      }

      if (!summaryRes.ok) {
        setError(BALANCES_ERROR);
        return;
      }

      const summaryJson = (await summaryRes.json()) as WalletSummaryResponse;
      if (summaryJson.configured && summaryJson.chainId !== 8453) {
        setError(WRONG_CHAIN_ERROR);
        return;
      }
      setSummary(summaryJson);

      if (!historyRes.ok) {
        setHistoryError(HISTORY_ERROR);
        setHistory({ configured: true, transfers: [] });
        return;
      }

      const historyJson = (await historyRes.json()) as HistoryResponse & {
        chainId?: number;
      };
      if (historyJson.chainId !== undefined && historyJson.chainId !== 8453) {
        setHistoryError(WRONG_CHAIN_ERROR);
        setHistory({ configured: true, transfers: [] });
        return;
      }
      setHistory(historyJson);
    } catch {
      setError(BALANCES_ERROR);
    } finally {
      setLoading(false);
    }
  }, [
    authenticated,
    getAccessToken,
    previewData,
    privyConfigured,
  ]);

  useEffect(() => {
    if (!ready || previewData) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await fetchWallet();
      if (cancelled) {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, fetchWallet, previewData]);

  const receiveUri = useMemo(() => {
    if (!summary || !summary.configured) {
      return null;
    }
    return buildEip681BaseUsdcReceiveUri(summary.address);
  }, [summary]);

  return (
    <div className="flex flex-col gap-5" data-testid="reader-wallet-panel">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Your wallet
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Read-only balances and USDC activity on Base.
        </p>
      </div>

      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {loading && !summary ? (
        <p className="text-sm text-zinc-500">Loading wallet…</p>
      ) : null}

      {summary && summary.configured ? (
        <>
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

          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Receive
            </p>
            <code className="mt-2 block break-all text-xs font-mono text-emerald-700 dark:text-emerald-400">
              {summary.address}
            </code>
            {receiveUri ? (
              <div className="mt-3 inline-flex max-w-full flex-col items-start gap-2">
                <span
                  className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                  data-testid="reader-wallet-receive-network-label"
                >
                  USDC on Base only
                </span>
                <QRCodeSVG
                  value={receiveUri}
                  size={200}
                  level="M"
                  marginSize={1}
                  className="max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                  data-testid="reader-wallet-receive-qr"
                  title="QR code for USDC on Base (EIP-681)"
                />
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              USDC history
            </p>
            {historyError ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                {historyError}
              </p>
            ) : null}
            <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
              {(history?.transfers ?? []).map((tx) => (
                <li
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
                >
                  <span
                    className={
                      tx.direction === "in"
                        ? "font-semibold text-emerald-700 dark:text-emerald-400"
                        : "font-semibold text-zinc-700 dark:text-zinc-300"
                    }
                  >
                    {tx.direction === "in" ? "Received" : "Sent"} {tx.value}{" "}
                    {tx.asset}
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
            {(history?.transfers ?? []).length === 0 && !historyError ? (
              <p className="mt-2 text-xs text-zinc-500">No recent USDC transfers.</p>
            ) : null}
          </div>
        </>
      ) : null}

      {!previewData ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setHistoryError(null);
            setLoading(true);
            void fetchWallet();
          }}
          disabled={loading}
          className="self-start rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      ) : null}
    </div>
  );
}
