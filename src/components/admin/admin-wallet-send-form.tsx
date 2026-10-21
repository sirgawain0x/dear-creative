"use client";

import { useCallback, useId, useRef, useState } from "react";
import { getAddress, isAddress } from "viem";
import { adminPrivyAuthorizationHeaders } from "@/lib/admin/admin-api-auth";
import type { AdminWalletSendAsset } from "@/lib/wallet/send-validation";
import {
  sendAdminWalletViaSmartWallet,
  type SmartWalletSendClient,
} from "@/lib/wallet/admin-wallet-smart-wallet-send";

type EstimateResponse = {
  recipient: string;
  amount: string;
  asset: AdminWalletSendAsset;
  warnings: string[];
  chain: { network: string; chainId: number };
  gas: {
    estimatedEth: string;
    sponsoredByPaymaster: boolean;
  };
};

type SendApiResponse =
  | {
      txHash: string;
      explorerUrl?: string;
      duplicate?: boolean;
    }
  | {
      mode: "client";
      calls: Array<{ to: string; value: string; data: `0x${string}` }>;
      recipient: string;
      amount: string;
      asset: AdminWalletSendAsset;
      chain: { network: string; chainId: number };
      gas: { estimatedEth: string; sponsoredByPaymaster: boolean };
    };

export type AdminWalletSendFormProps = {
  walletAddress: string;
  isAdmin: boolean;
  walletSendEnabled: boolean;
  getAccessToken: () => Promise<string | null>;
  privyConfigured: boolean;
  authenticated: boolean;
  smartWalletClient?: SmartWalletSendClient | null;
  previewMode?: boolean;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `admin-send-${crypto.randomUUID()}`;
  }
  return `admin-send-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AdminWalletSendForm({
  walletAddress,
  isAdmin,
  walletSendEnabled,
  getAccessToken,
  privyConfigured,
  authenticated,
  smartWalletClient,
  previewMode = false,
}: AdminWalletSendFormProps) {
  const recipientId = useId();
  const amountId = useId();
  const assetId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<AdminWalletSendAsset>("USDC");
  const [localError, setLocalError] = useState<string | null>(null);
  const [localWarning, setLocalWarning] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

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
      if (checksum.toLowerCase() === walletAddress.toLowerCase()) {
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
    if (previewMode) {
      setEstimate({
        recipient: getAddress(recipient.trim()),
        amount: amount.trim(),
        asset,
        warnings: localWarning ? [localWarning] : [],
        chain: { network: "base", chainId: 8453 },
        gas: { estimatedEth: "0.000021", sponsoredByPaymaster: true },
      });
      setStep("confirm");
      return;
    }
    const headers = await adminPrivyAuthorizationHeaders({
      privyConfigured,
      authenticated,
      getAccessToken,
    });
    if (!headers) {
      setLocalError("Sign in with Privy to send.");
      return;
    }
    const res = await fetch("/api/admin/wallet/send/estimate", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: recipient.trim(), amount: amount.trim(), asset }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setLocalError(json?.error ?? "Could not estimate send.");
      return;
    }
    const json = (await res.json()) as EstimateResponse;
    setEstimate(json);
    if (json.warnings[0]) {
      setLocalWarning(json.warnings[0] ?? null);
    }
    setStep("confirm");
  }, [
    amount,
    asset,
    authenticated,
    getAccessToken,
    localWarning,
    previewMode,
    privyConfigured,
    recipient,
  ]);

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
      if (previewMode) {
        setTxHash(
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        );
        setStep("done");
        return;
      }

      const headers = await adminPrivyAuthorizationHeaders({
        privyConfigured,
        authenticated,
        getAccessToken,
      });
      if (!headers) {
        setLocalError("Sign in with Privy to send.");
        return;
      }

      const res = await fetch("/api/admin/wallet/send", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: estimate.recipient,
          amount: estimate.amount,
          asset: estimate.asset,
          idempotencyKey,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | (SendApiResponse & { error?: string })
        | null;

      if (!res.ok) {
        setLocalError(json?.error ?? "Send request failed.");
        return;
      }

      if (json && "txHash" in json && json.txHash) {
        setTxHash(json.txHash);
        setStep("done");
        return;
      }

      if (json && "mode" in json && json.mode === "client") {
        if (!smartWalletClient) {
          setLocalError(
            "Smart wallet is not ready. Open Privy smart wallet for this account.",
          );
          return;
        }
        const hash = await sendAdminWalletViaSmartWallet(
          smartWalletClient,
          json.calls.map((c) => ({
            to: getAddress(c.to),
            value: c.value,
            data: c.data,
          })),
        );
        setTxHash(hash);
        setStep("done");
        return;
      }

      setLocalError("Unexpected send response.");
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

  if (!isAdmin || !walletSendEnabled) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Send on Base
        </p>
        {!open ? (
          <button
            type="button"
            data-testid="admin-wallet-send-open"
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

      {open && step === "form" ? (
        <div className="mt-4 space-y-3" data-testid="admin-wallet-send-form">
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
                onChange={(e) => setAsset(e.target.value as AdminWalletSendAsset)}
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
        <div className="mt-4 space-y-3" data-testid="admin-wallet-send-confirm">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Confirm sending{" "}
            <span className="font-semibold">
              {estimate.amount} {estimate.asset}
            </span>{" "}
            on Base to:
          </p>
          <code className="block break-all rounded-lg bg-zinc-50 p-2 font-mono text-[10px] dark:bg-zinc-950">
            {estimate.recipient}
          </code>
          <ul className="text-xs text-zinc-500">
            <li>Chain: Base ({estimate.chain.chainId})</li>
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
        <div className="mt-4 space-y-2" data-testid="admin-wallet-send-success">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Transaction submitted
          </p>
          <a
            className="break-all font-mono text-[10px] text-zinc-600 underline dark:text-zinc-400"
            href={`https://basescan.org/tx/${txHash}`}
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
