"use client";

import { useAuthorizationSignature } from "@privy-io/react-auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseUnits } from "viem";
import { adminPrivyAuthorizationHeaders } from "@/lib/admin/admin-api-auth";
import {
  buildEarnDepositAuthorizationPayload,
  buildEarnWithdrawAuthorizationPayload,
} from "@/lib/earn/authorization-signature-payload";
import { EARN_ACTION_MAX_RAW_AMOUNT, USDC_DECIMALS } from "@/lib/earn/actions-limits";
import { formatTokenAmountFromRaw } from "@/lib/earn/format";

export type EarnActionsVaultOption = {
  id: string;
  name: string;
  provider: "aave" | "morpho" | "veda";
};

export type EarnActionsPreviewState =
  | {
      phase: "confirm";
      direction: "deposit" | "withdraw";
      amountDisplay: string;
      vault: EarnActionsVaultOption;
    }
  | { phase: "pending"; actionId: string; direction: "deposit" | "withdraw" }
  | { phase: "success"; actionId: string; direction: "deposit" | "withdraw" };

export type EarnActionsFlowProps = {
  enabled: boolean;
  walletId: string;
  walletAddress: string;
  vaults: EarnActionsVaultOption[];
  selectedVaultId: string;
  getAccessToken: () => Promise<string | null>;
  privyConfigured: boolean;
  authenticated: boolean;
  previewState?: EarnActionsPreviewState;
};

type FlowPhase = "form" | "confirm" | "submitting" | "pending" | "success" | "error";

function providerLabel(provider: EarnActionsVaultOption["provider"]): string {
  switch (provider) {
    case "aave":
      return "Aave";
    case "morpho":
      return "Morpho";
    case "veda":
      return "Veda";
    default: {
      const _never: never = provider;
      return _never;
    }
  }
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `earn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function EarnActionsFlow({
  enabled,
  walletId,
  walletAddress,
  vaults,
  selectedVaultId,
  getAccessToken,
  privyConfigured,
  authenticated,
  previewState,
}: EarnActionsFlowProps) {
  const { generateAuthorizationSignature } = useAuthorizationSignature();
  const [direction, setDirection] = useState<"deposit" | "withdraw">("deposit");
  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<FlowPhase>(
    previewState?.phase === "confirm"
      ? "confirm"
      : previewState?.phase === "pending"
        ? "pending"
        : previewState?.phase === "success"
          ? "success"
          : "form",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(
    previewState?.phase === "pending" || previewState?.phase === "success"
      ? previewState.actionId
      : null,
  );
  const [actionStatus, setActionStatus] = useState<string | null>(
    previewState?.phase === "success" ? "succeeded" : null,
  );
  const [submitLocked, setSubmitLocked] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const vault = useMemo(
    () => vaults.find((v) => v.id === selectedVaultId) ?? vaults[0] ?? null,
    [vaults, selectedVaultId],
  );

  const rawAmount = useMemo(() => {
    if (previewState?.phase === "confirm") {
      try {
        return parseUnits(previewState.amountDisplay, USDC_DECIMALS).toString();
      } catch {
        return null;
      }
    }
    try {
      return parseUnits(amountInput.trim() || "0", USDC_DECIMALS).toString();
    } catch {
      return null;
    }
  }, [amountInput, previewState]);

  const amountDisplay = useMemo(() => {
    if (previewState?.phase === "confirm") {
      return previewState.amountDisplay;
    }
    if (!rawAmount) {
      return amountInput;
    }
    return formatTokenAmountFromRaw(rawAmount, USDC_DECIMALS);
  }, [amountInput, previewState, rawAmount]);

  const pollActionStatus = useCallback(async () => {
    if (previewState || !pendingActionId) {
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
    const params = new URLSearchParams({
      walletId,
      walletAddress,
      actionId: pendingActionId,
    });
    const res = await fetch(`/api/earn/actions/status?${params.toString()}`, {
      headers,
    });
    if (!res.ok) {
      return;
    }
    const json = (await res.json()) as {
      action?: { status?: string };
    };
    const status = json.action?.status ?? null;
    setActionStatus(status);
    if (status === "succeeded") {
      setPhase("success");
    } else if (status === "failed" || status === "rejected") {
      setPhase("error");
      setError(`Action ${status}.`);
    }
  }, [
    authenticated,
    getAccessToken,
    pendingActionId,
    previewState,
    privyConfigured,
    walletAddress,
    walletId,
  ]);

  useEffect(() => {
    if (phase !== "pending" || previewState) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await pollActionStatus();
      if (cancelled) {
        return;
      }
    })();
    const timer = window.setInterval(() => {
      void pollActionStatus();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phase, pollActionStatus, previewState]);

  const handleConfirmSubmit = async () => {
    if (previewState || submitLocked || !vault || !rawAmount) {
      return;
    }
    if (BigInt(rawAmount) > EARN_ACTION_MAX_RAW_AMOUNT) {
      setError("Amount exceeds the configured cap.");
      return;
    }
    setSubmitLocked(true);
    setPhase("submitting");
    setError(null);
    try {
      const headers = await adminPrivyAuthorizationHeaders({
        privyConfigured,
        authenticated,
        getAccessToken,
      });
      if (!headers) {
        setError("Sign in to submit Earn actions.");
        setPhase("confirm");
        return;
      }

      const idempotencyKey =
        idempotencyKeyRef.current ?? createIdempotencyKey();
      idempotencyKeyRef.current = idempotencyKey;

      const payload =
        direction === "deposit"
          ? buildEarnDepositAuthorizationPayload({
              walletId,
              vaultId: vault.id,
              rawAmount,
              idempotencyKey,
            })
          : buildEarnWithdrawAuthorizationPayload({
              walletId,
              vaultId: vault.id,
              rawAmount,
              idempotencyKey,
            });

      const { signature } = await generateAuthorizationSignature(payload);

      const endpoint =
        direction === "deposit"
          ? "/api/earn/actions/deposit"
          : "/api/earn/actions/withdraw";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "privy-authorization-signature": signature,
          "privy-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          walletId,
          walletAddress,
          vaultId: vault.id,
          rawAmount,
        }),
      });

      const json = (await res.json()) as {
        action?: { id?: string; status?: string };
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Request failed.");
        setPhase("error");
        return;
      }
      const actionId = json.action?.id ?? null;
      setPendingActionId(actionId);
      setActionStatus(json.action?.status ?? "pending");
      setPhase("pending");
    } catch {
      setError("Could not submit Earn action.");
      setPhase("error");
    } finally {
      setSubmitLocked(false);
    }
  };

  if (!enabled) {
    return (
      <p className="text-xs text-zinc-500">
        Earn deposits and withdrawals are disabled. Set{" "}
        <code>EARN_ACTIONS_ENABLED=true</code>.
      </p>
    );
  }

  if (!walletId || !walletAddress) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-300">
        Configure a Privy wallet id and address to use Earn actions.
      </p>
    );
  }

  const previewVault =
    previewState?.phase === "confirm" ? previewState.vault : vault;
  const previewDirection =
    previewState?.phase === "confirm" ? previewState.direction : direction;

  return (
    <div className="space-y-3" data-testid="earn-actions-flow">
      {phase === "form" && !previewState ? (
        <>
          <div className="flex gap-2">
            {(["deposit", "withdraw"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDirection(value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  direction === value
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Amount (USDC)
            <input
              inputMode="decimal"
              className="mt-1 w-full min-w-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              placeholder="0.00"
            />
          </label>
          <button
            type="button"
            disabled={!rawAmount || BigInt(rawAmount) <= BigInt(0)}
            onClick={() => setPhase("confirm")}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Review {direction}
          </button>
        </>
      ) : null}

      {phase === "confirm" || previewState?.phase === "confirm" ? (
        <div
          className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          data-testid="earn-actions-confirm"
        >
          <p className="font-semibold">Confirm {previewDirection}</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <li>
              Vault: {previewVault?.name} ({providerLabel(previewVault!.provider)})
            </li>
            <li>Direction: {previewDirection}</li>
            <li>Amount: {amountDisplay} USDC</li>
            <li className="break-all font-mono text-[10px]">
              Wallet: {walletAddress}
            </li>
          </ul>
          {!previewState ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs"
                onClick={() => setPhase("form")}
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitLocked || phase === "submitting"}
                onClick={() => void handleConfirmSubmit()}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {phase === "submitting" ? "Submitting…" : "Sign & submit"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === "pending" || previewState?.phase === "pending" ? (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs dark:border-amber-900/50 dark:bg-amber-950/30"
          data-testid="earn-actions-pending"
        >
          <p className="font-semibold">Pending onchain confirmation</p>
          <p className="mt-1 font-mono text-[10px]">
            Action:{" "}
            {pendingActionId ??
              (previewState?.phase === "pending" ? previewState.actionId : "")}
          </p>
          <p className="mt-1">Status: {actionStatus ?? "pending"}</p>
        </div>
      ) : null}

      {phase === "success" || previewState?.phase === "success" ? (
        <div
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
          data-testid="earn-actions-success"
        >
          <p className="font-semibold">Earn action succeeded</p>
          <p className="mt-1 font-mono text-[10px]">
            Action:{" "}
            {pendingActionId ??
              (previewState?.phase === "success" ? previewState.actionId : "")}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
