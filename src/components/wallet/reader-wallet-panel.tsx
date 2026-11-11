"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { privyAuthorizationHeaders } from "@/lib/privy/privy-authorization-headers";
import { PrivyBridgeContext } from "@/components/providers/privy-root-provider";
import { HostedCoinbaseCheckoutButton } from "./reader-wallet-onramp";
import { ReaderWalletCreateButton, ReaderWalletSend } from "./reader-wallet-transactions";
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
      embeddedOnramp?: boolean;
      balances: {
        eth: { formatted: string };
        usdc: { formatted: string; raw?: string };
      } | null;
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
  onOpenCheckout?: () => void;
};

const BALANCES_ERROR = "Balances are temporarily unavailable.";
const HISTORY_ERROR = "Transfer history is temporarily unavailable.";
const SIGN_IN_ERROR = "Sign in with Privy to view your wallet.";
const WRONG_CHAIN_ERROR = "Wallet reads are limited to Base (chain 8453).";

export function ReaderWalletPanel({ previewData, onOpenCheckout }: ReaderWalletPanelProps) {
  const {
    ready,
    authenticated,
    getAccessToken,
    privyConfigured,
  } = useAuthSession();

  const privy = useContext(PrivyBridgeContext);
  const [needsWallet, setNeedsWallet] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [loading, setLoading] = useState(() => !previewData);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WalletSummaryResponse | null>(
    previewData?.summary ?? null,
  );
  const [history, setHistory] = useState<HistoryResponse | null>(
    previewData?.history ?? null,
  );

  const getHeaders = useCallback(
    () => privyAuthorizationHeaders({ privyConfigured, authenticated, getAccessToken }),
    [privyConfigured, authenticated, getAccessToken],
  );

  const fetchWallet = useCallback(async () => {
    if (previewData) {
      return;
    }

    setNeedsWallet(false);
    setError(null);
    setHistoryError(null);
    try {
      const headers = await getHeaders();
      if (!authenticated || !headers) {
        setError(SIGN_IN_ERROR);
        setSummary(null);
        setHistory(null);
        return;
      }

      const [summaryResult, historyResult] = await Promise.allSettled([
        fetch("/api/wallet/me", { headers }),
        fetch("/api/wallet/history", { headers }),
      ]);

      if (summaryResult.status === "rejected") {
        setError(BALANCES_ERROR);
        return;
      }
      const summaryRes = summaryResult.value;

      if (summaryRes.status === 404 && !summaryRes.ok) {
        const body = (await summaryRes.json().catch(() => null)) as {
          reason?: string;
        } | null;
        if (body?.reason === "no_embedded_wallet") {
          setNeedsWallet(true);
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

      if (historyResult.status === "rejected" || !historyResult.value.ok) {
        setHistoryError(HISTORY_ERROR);
        setHistory(null);
        return;
      }

      const historyJson = (await historyResult.value.json().catch(() => null)) as (HistoryResponse & {
        chainId?: number;
      }) | null;
      if (!historyJson?.configured || !Array.isArray(historyJson.transfers)) {
        setHistoryError(HISTORY_ERROR);
        setHistory(null);
        return;
      }
      if (historyJson.chainId !== undefined && historyJson.chainId !== 8453) {
        setHistoryError(WRONG_CHAIN_ERROR);
        setHistory(null);
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
    getHeaders,
    previewData,
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

  return (
    <div className="flex flex-col gap-5" data-testid="reader-wallet-panel">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Your wallet
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Receive and send USDC on Base.
        </p>
      </div>

      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {needsWallet && privy?.authenticated && (
        <ReaderWalletCreateButton onCreated={fetchWallet} />
      )}

      {loading && !summary ? (
        <p className="text-sm text-zinc-500">Loading wallet…</p>
      ) : null}

      {summary && summary.configured && (previewData || authenticated) ? (
        <>
          {summary.balances ? (
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
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-300">{BALANCES_ERROR}</p>
          )}

          <div className="flex flex-wrap gap-3">
            {!previewData && privy?.authenticated ? (
              summary.embeddedOnramp && onOpenCheckout ? (
                <button
                  type="button"
                  className="rounded-full border px-3 py-1 text-sm"
                  aria-haspopup="dialog"
                  onClick={onOpenCheckout}
                >
                  Add USDC
                </button>
              ) : (
                <HostedCoinbaseCheckoutButton
                  getHeaders={getHeaders}
                  label="Add USDC"
                  className="rounded-full border px-3 py-1 text-sm"
                />
              )
            ) : null}
            <button
              type="button"
              aria-expanded={receiving}
              className="rounded-full border px-3 py-1 text-sm"
              onClick={() => {
                setCopyStatus("");
                setReceiving(!receiving);
              }}
            >
              Receive
            </button>
            {!previewData && privy?.authenticated && (
              <ReaderWalletSend address={summary.address} balance={summary.balances?.usdc.raw} />
            )}
          </div>
          {receiving && (
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm font-medium">Receive USDC on Base</p>
              <code className="my-2 block break-all text-xs">{summary.address}</code>
              <button
                type="button"
                className="rounded-full border px-3 py-1 text-xs"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(summary.address);
                    setCopyStatus("Address copied.");
                  } catch {
                    setCopyStatus("Couldn’t copy automatically. Select the address to copy it.");
                  }
                }}
              >
                Copy address
              </button>
              <p role="status" className="mt-2 text-xs">{copyStatus}</p>
            </div>
          )}

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
            {history && history.transfers.length === 0 && !historyError && !loading ? (
              <p className="mt-2 text-xs text-zinc-500">No USDC transfers found.</p>
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
