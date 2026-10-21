"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { SWAP_QUOTE_EXPIRY_BUFFER_SEC, type SwapDirection } from "@/lib/wallet/swap-constants";
import { isQuoteNearOrPastExpiry } from "@/lib/wallet/swap-expiry";
import type { WalletSwapPort, WalletSwapQuoteSummary } from "./wallet-swap-types";

export type WalletSwapFormProps = {
  enabled: boolean;
  adminAddress: string;
  swapPort: WalletSwapPort;
  signPreparedSwap?: (prepared: Record<string, unknown>) => Promise<`0x${string}`>;
  fixtureInitialStep?: "form" | "confirm" | "pending" | "success";
  fixtureQuote?: WalletSwapQuoteSummary;
};

function formatMinimumReceived(summary: WalletSwapQuoteSummary): string {
  const min = summary.quote.minimumToAmount;
  if (summary.direction === "USDC_TO_ETH") {
    const wei = BigInt(min);
    return `${(Number(wei) / 1e18).toFixed(6)} ETH`;
  }
  const micro = BigInt(min);
  return `${(Number(micro) / 1e6).toFixed(2)} USDC`;
}

export function WalletSwapForm({
  enabled,
  adminAddress,
  swapPort,
  signPreparedSwap,
  fixtureInitialStep,
  fixtureQuote,
}: WalletSwapFormProps) {
  const amountId = useId();
  const [open, setOpen] = useState(
    () => Boolean(fixtureInitialStep && fixtureInitialStep !== "form"),
  );
  const [step, setStep] = useState<"form" | "confirm" | "pending" | "success">(
    () => fixtureInitialStep ?? "form",
  );
  const [direction, setDirection] = useState<SwapDirection>("USDC_TO_ETH");
  const [amount, setAmount] = useState("10");
  const [quote, setQuote] = useState<WalletSwapQuoteSummary | null>(
    () => fixtureQuote ?? null,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(
    () => (fixtureInitialStep === "success" ? "0xpreviewswap" : null),
  );
  const inFlightRef = useRef(false);

  const toLabel = useMemo(
    () => (direction === "USDC_TO_ETH" ? "ETH" : "USDC"),
    [direction],
  );

  const fetchQuote = useCallback(async () => {
    const result = await swapPort.requestQuote({ direction, amount: amount.trim() });
    if ("error" in result) {
      setLocalError(result.error);
      return null;
    }
    setQuote(result);
    return result;
  }, [amount, direction, swapPort]);

  const handleReview = async () => {
    setLocalError(null);
    const q = await fetchQuote();
    if (q) {
      setStep("confirm");
    }
  };

  const handleConfirmSwap = async () => {
    if (inFlightRef.current || pending || !quote) {
      return;
    }
    inFlightRef.current = true;
    setPending(true);
    setLocalError(null);

    try {
      let activeQuote = quote;
      if (
        isQuoteNearOrPastExpiry(
          activeQuote.quote.expiry,
          Date.now() + SWAP_QUOTE_EXPIRY_BUFFER_SEC * 1000,
        )
      ) {
        const refreshed = await fetchQuote();
        if (!refreshed) {
          return;
        }
        activeQuote = refreshed;
        setQuote(refreshed);
      }

      let signature: `0x${string}`;
      if (signPreparedSwap) {
        signature = await signPreparedSwap(activeQuote.prepared);
      } else {
        signature = "0x11" as `0x${string}`;
      }

      const submitted = await swapPort.submitSwap({
        prepared: activeQuote.prepared,
        signature,
      });
      if ("error" in submitted) {
        setLocalError(submitted.error);
        return;
      }

      setStep("pending");
      const status = await swapPort.pollStatus(submitted.callId);
      if ("error" in status) {
        setLocalError(status.error);
        setStep("confirm");
        return;
      }
      if (status.status === 200) {
        setTxHash(status.txHash ?? null);
        setStep("success");
      } else {
        setLocalError("Swap is still pending or failed. Check status later.");
        setStep("confirm");
      }
    } catch {
      setLocalError("Swap failed.");
    } finally {
      setPending(false);
      inFlightRef.current = false;
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Swap on Base (ETH ↔ USDC)
        </p>
        {!open ? (
          <button
            type="button"
            data-testid="wallet-swap-open"
            onClick={() => setOpen(true)}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Swap
          </button>
        ) : (
          <button type="button" onClick={() => setOpen(false)} className="text-xs underline">
            Close
          </button>
        )}
      </div>

      {open && step === "form" ? (
        <div className="mt-4 space-y-3" data-testid="wallet-swap-form">
          <div>
            <label className="text-xs font-medium text-zinc-600">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as SwapDirection)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="USDC_TO_ETH">USDC → ETH</option>
              <option value="ETH_TO_USDC">ETH → USDC</option>
            </select>
          </div>
          <div>
            <label htmlFor={amountId} className="text-xs font-medium text-zinc-600">
              Amount ({direction === "USDC_TO_ETH" ? "USDC" : "ETH"})
            </label>
            <input
              id={amountId}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          {localError ? (
            <p className="text-xs text-red-600 dark:text-red-400">{localError}</p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleReview()}
            className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Review swap
          </button>
        </div>
      ) : null}

      {open && step === "confirm" && quote ? (
        <div className="mt-4 space-y-3" data-testid="wallet-swap-confirm">
          <ul className="text-xs text-zinc-600 dark:text-zinc-400">
            <li>
              From: <span className="font-mono text-[10px]">{quote.from}</span>
            </li>
            <li>
              Swap: {quote.amount} {direction === "USDC_TO_ETH" ? "USDC" : "ETH"} → {toLabel}
            </li>
            <li>Minimum received: {formatMinimumReceived(quote)}</li>
            <li>Chain: Base ({quote.chainId})</li>
            {quote.needsWalletUpgrade ? (
              <li className="font-semibold text-amber-700 dark:text-amber-300">
                One-time wallet upgrade (EIP-7702 to Alchemy Modular Account v2) required before
                this swap executes.
              </li>
            ) : null}
          </ul>
          {localError ? (
            <p className="text-xs text-red-600 dark:text-red-400">{localError}</p>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleConfirmSwap()}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Confirm swap"}
          </button>
        </div>
      ) : null}

      {open && step === "pending" ? (
        <div className="mt-4 space-y-2" data-testid="wallet-swap-pending">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Swap submitted — waiting for confirmation…
          </p>
        </div>
      ) : null}

      {open && step === "success" ? (
        <div className="mt-4 space-y-2" data-testid="wallet-swap-success">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Swap confirmed
          </p>
          {txHash ? (
            <code className="block break-all font-mono text-[10px]">{txHash}</code>
          ) : null}
        </div>
      ) : null}

      {open && adminAddress ? (
        <p className="mt-2 text-[10px] text-zinc-500">Admin wallet: {adminAddress}</p>
      ) : null}
    </div>
  );
}
