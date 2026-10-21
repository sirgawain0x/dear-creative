"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { getAddress, isAddress } from "viem";
import {
  defaultBaseTxExplorerUrl,
  type WalletSendAsset,
  type WalletSendContext,
  type WalletSendEstimate,
  type WalletSendPort,
} from "./wallet-send-types";

export type WalletSendFormProps = {
  /** When false, nothing is rendered (consumer decides visibility). */
  enabled: boolean;
  wallet: WalletSendContext;
  sendPort: WalletSendPort;
  chainLabel?: string;
  /** Screenshot fixtures: open on a step with prefilled data. */
  fixtureInitialStep?: "form" | "confirm";
  fixtureConfirmEstimate?: WalletSendEstimate;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `wallet-send-${crypto.randomUUID()}`;
  }
  return `wallet-send-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function WalletSendForm({
  enabled,
  wallet,
  sendPort,
  chainLabel = "Base",
  fixtureInitialStep,
  fixtureConfirmEstimate,
}: WalletSendFormProps) {
  const recipientId = useId();
  const amountId = useId();
  const assetId = useId();
  const [open, setOpen] = useState(() => Boolean(fixtureInitialStep));
  const [step, setStep] = useState<"form" | "confirm" | "done">(
    () => fixtureInitialStep ?? "form",
  );
  const [recipient, setRecipient] = useState(() =>
    fixtureInitialStep === "confirm"
      ? (fixtureConfirmEstimate?.recipient ??
          getAddress("0x2222222222222222222222222222222222222222"))
      : "",
  );
  const [amount, setAmount] = useState(() =>
    fixtureInitialStep === "confirm" ? (fixtureConfirmEstimate?.amount ?? "10.5") : "",
  );
  const [asset, setAsset] = useState<WalletSendAsset>(
    () => fixtureConfirmEstimate?.asset ?? "USDC",
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [localWarning, setLocalWarning] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<WalletSendEstimate | null>(() =>
    fixtureInitialStep === "confirm"
      ? (fixtureConfirmEstimate ?? {
          recipient: getAddress("0x2222222222222222222222222222222222222222"),
          amount: "10.5",
          asset: "USDC",
          warnings: [],
          chain: wallet.chain,
          gas: { estimatedEth: "0.000021", sponsoredByPaymaster: true },
        })
      : null,
  );
  const [pending, setPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const txUrl = useMemo(
    () => wallet.txExplorerUrl ?? defaultBaseTxExplorerUrl,
    [wallet.txExplorerUrl],
  );

  const validateLocal = (): boolean => {
    setLocalError(null);
    setLocalWarning(null);
    const trimmed = recipient.trim();
    if (!trimmed) {
      setLocalError("Recipient address is required.");
      return false;
    }
    if (!isAddress(trimmed, { strict: true })) {
      setLocalError("Use a checksummed address.");
      return false;
    }
    try {
      const checksum = getAddress(trimmed);
      if (checksum.toLowerCase() === wallet.address.toLowerCase()) {
        setLocalWarning("Recipient is the same as this wallet address.");
      }
    } catch {
      setLocalError("Use a checksummed address.");
      return false;
    }
    const n = Number(amount.trim());
    if (!Number.isFinite(n) || n <= 0) {
      setLocalError("Enter a positive amount.");
      return false;
    }
    return true;
  };

  const fetchEstimate = useCallback(async () => {
    const result = await sendPort.estimateSend({
      recipient: recipient.trim(),
      amount: amount.trim(),
      asset,
    });
    if ("error" in result) {
      setLocalError(result.error);
      return;
    }
    setEstimate(result);
    if (result.warnings[0]) {
      setLocalWarning(result.warnings[0] ?? null);
    }
    setStep("confirm");
  }, [amount, asset, recipient, sendPort]);

  const handleReview = () => {
    if (!validateLocal()) {
      return;
    }
    setLocalError(null);
    void fetchEstimate();
  };

  const handleConfirmSend = async () => {
    if (inFlightRef.current || pending) {
      return;
    }
    if (!estimate) {
      return;
    }
    inFlightRef.current = true;
    setPending(true);
    setLocalError(null);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = newIdempotencyKey();
    }
    const idempotencyKey = idempotencyKeyRef.current;

    try {
      const result = await sendPort.executeSend({
        recipient: estimate.recipient,
        amount: estimate.amount,
        asset: estimate.asset,
        idempotencyKey,
      });
      if (!result.ok) {
        setLocalError(result.error);
        return;
      }
      setTxHash(result.txHash);
      setStep("done");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setPending(false);
      inFlightRef.current = false;
    }
  };

  const resetForm = () => {
    setOpen(false);
    setStep("form");
    setEstimate(null);
    setTxHash(null);
    setLocalError(null);
    idempotencyKeyRef.current = null;
    inFlightRef.current = false;
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Send on {chainLabel}
        </p>
        {!open ? (
          <button
            type="button"
            data-testid="wallet-send-open"
            onClick={() => setOpen(true)}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Send
          </button>
        ) : (
          <button
            type="button"
            onClick={resetForm}
            className="text-xs text-zinc-500 underline"
          >
            Close
          </button>
        )}
      </div>

      {wallet.balances ? (
        <p className="mt-2 text-[10px] text-zinc-500">
          Available: {wallet.balances.usdc.formatted} USDC · {wallet.balances.eth.formatted} ETH
        </p>
      ) : null}

      {open && step === "form" ? (
        <div className="mt-4 space-y-3" data-testid="wallet-send-form">
          <div>
            <label htmlFor={recipientId} className="text-xs font-medium text-zinc-600">
              Recipient
            </label>
            <input
              id={recipientId}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x… checksummed"
              className="mt-1 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={amountId} className="text-xs font-medium text-zinc-600">
                Amount
              </label>
              <input
                id={amountId}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label htmlFor={assetId} className="text-xs font-medium text-zinc-600">
                Token
              </label>
              <select
                id={assetId}
                value={asset}
                onChange={(e) => setAsset(e.target.value as WalletSendAsset)}
                className="mt-1 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
              </select>
            </div>
          </div>
          {localWarning ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">{localWarning}</p>
          ) : null}
          {localError ? (
            <p className="text-xs text-red-600 dark:text-red-400">{localError}</p>
          ) : null}
          <button
            type="button"
            onClick={handleReview}
            className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Review send
          </button>
        </div>
      ) : null}

      {open && step === "confirm" && estimate ? (
        <div className="mt-4 space-y-3" data-testid="wallet-send-confirm">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Confirm sending{" "}
            <span className="font-semibold">
              {estimate.amount} {estimate.asset}
            </span>{" "}
            on {chainLabel} to:
          </p>
          <code className="block break-all rounded-lg bg-zinc-50 p-2 font-mono text-[10px] dark:bg-zinc-950">
            {estimate.recipient}
          </code>
          <ul className="text-xs text-zinc-500">
            <li>
              Chain: {estimate.chain.network} ({estimate.chain.chainId})
            </li>
            <li>
              Est. gas: {estimate.gas.estimatedEth} ETH (
              {estimate.gas.sponsoredByPaymaster ? "sponsored by paymaster" : "not sponsored"})
            </li>
          </ul>
          {localError ? (
            <p className="text-xs text-red-600 dark:text-red-400">{localError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void handleConfirmSend()}
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Sending…" : "Confirm send"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setStep("form")}
              className="rounded-full border border-zinc-300 px-4 py-2 text-xs dark:border-zinc-700"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {open && step === "done" && txHash ? (
        <div className="mt-4 space-y-2" data-testid="wallet-send-success">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Transaction submitted
          </p>
          <a
            className="break-all font-mono text-[10px] text-zinc-600 underline dark:text-zinc-400"
            href={txUrl(txHash)}
            target="_blank"
            rel="noreferrer"
          >
            {txHash}
          </a>
        </div>
      ) : null}
    </div>
  );
}
