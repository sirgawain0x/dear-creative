"use client";

import { useCallback, useMemo, useState } from "react";
import { encodeFunctionData, erc20Abi, type Address } from "viem";
import { useSendTransaction } from "@privy-io/react-auth";
import { useAuthSession } from "@/components/providers/app-providers";
import type { SubscriptionPlan } from "@/db/schema";

export type PostPaywallCheckoutProps = {
  title: string;
  postSlug: string;
  writerId: string | null;
  payToSplitAddress: string | null;
  unlockPriceUsdc: number | null;
  unlockAmountRaw: string | null;
  showSubscribe: boolean;
  subscriptionPlans: Array<{
    plan: SubscriptionPlan;
    priceUsdc: number;
    amountRaw: string;
    periodDays: number;
  }>;
  chainId: number;
  tokenAddress: string;
  subscriptionSummary: {
    periodEnd: string;
    showRenewPrompt: boolean;
    expired: boolean;
  } | null;
};

const CHECKOUT_ERRORS = {
  sign_in: "Sign in with your wallet to continue.",
  payout_missing: "Writer payout is not configured yet.",
  wallet_missing: "Connect a wallet to pay with USDC.",
  transfer_failed: "Payment was not completed.",
  verify_failed: "Payment could not be verified.",
} as const;

export function PostPaywallCheckout({
  title,
  postSlug,
  writerId,
  payToSplitAddress,
  unlockPriceUsdc,
  unlockAmountRaw,
  showSubscribe,
  subscriptionPlans,
  chainId,
  tokenAddress,
  subscriptionSummary,
}: PostPaywallCheckoutProps) {
  const { authenticated, login, getAccessToken, privyConfigured } =
    useAuthSession();
  const { sendTransaction } = useSendTransaction();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("monthly");
  const [busy, setBusy] = useState<"unlock" | "subscribe" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const unlockEnabled =
    Boolean(unlockAmountRaw && unlockPriceUsdc && payToSplitAddress);

  const selectedPlanQuote = useMemo(
    () => subscriptionPlans.find((p) => p.plan === selectedPlan) ?? null,
    [subscriptionPlans, selectedPlan],
  );

  const sendUsdc = useCallback(
    async (amountRaw: string, to: Address) => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [to, BigInt(amountRaw)],
      });
      const { hash } = await sendTransaction({
        to: tokenAddress as Address,
        data,
        chainId,
      });
      return hash;
    },
    [chainId, sendTransaction, tokenAddress],
  );

  const verifyUnlock = useCallback(
    async (txHash: string) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(CHECKOUT_ERRORS.sign_in);
      }
      const res = await fetch("/api/paywall/reader/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slug: postSlug, txHash }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        throw new Error(json.error ?? CHECKOUT_ERRORS.verify_failed);
      }
    },
    [getAccessToken, postSlug],
  );

  const verifySubscribe = useCallback(
    async (txHash: string) => {
      if (!writerId) {
        throw new Error(CHECKOUT_ERRORS.payout_missing);
      }
      const token = await getAccessToken();
      if (!token) {
        throw new Error(CHECKOUT_ERRORS.sign_in);
      }
      const res = await fetch("/api/paywall/reader/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          writerId,
          plan: selectedPlan,
          txHash,
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        throw new Error(json.error ?? CHECKOUT_ERRORS.verify_failed);
      }
    },
    [getAccessToken, selectedPlan, writerId],
  );

  const handleUnlock = async () => {
    setError(null);
    setSuccess(null);
    if (!privyConfigured) {
      setError(CHECKOUT_ERRORS.wallet_missing);
      return;
    }
    if (!authenticated) {
      login();
      return;
    }
    if (!unlockEnabled || !payToSplitAddress || !unlockAmountRaw) {
      return;
    }
    setBusy("unlock");
    try {
      const hash = await sendUsdc(
        unlockAmountRaw,
        payToSplitAddress as Address,
      );
      await verifyUnlock(hash);
      setSuccess("Post unlocked — reload to read the full piece.");
      window.location.reload();
    } catch {
      setError(CHECKOUT_ERRORS.transfer_failed);
    } finally {
      setBusy(null);
    }
  };

  const handleSubscribe = async () => {
    setError(null);
    setSuccess(null);
    if (!privyConfigured) {
      setError(CHECKOUT_ERRORS.wallet_missing);
      return;
    }
    if (!authenticated) {
      login();
      return;
    }
    if (!showSubscribe || !selectedPlanQuote || !payToSplitAddress) {
      return;
    }
    setBusy("subscribe");
    try {
      const hash = await sendUsdc(
        selectedPlanQuote.amountRaw,
        payToSplitAddress as Address,
      );
      await verifySubscribe(hash);
      setSuccess("Subscription active — reload to read subscriber posts.");
      window.location.reload();
    } catch {
      setError(CHECKOUT_ERRORS.transfer_failed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      className="my-10 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-8 dark:border-amber-900/50 dark:bg-amber-950/30"
      aria-labelledby="post-paywall-heading"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
        Subscriber content
      </p>
      <h2
        id="post-paywall-heading"
        className="mt-2 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100"
      >
        Continue reading &ldquo;{title}&rdquo;
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
        Pay USDC on Base directly to the writer&apos;s split — no card, no
        auto-renew pull. Sign with your Privy wallet.
      </p>

      {subscriptionSummary?.showRenewPrompt ? (
        <p
          className="mx-auto mt-4 max-w-md rounded-lg border border-amber-300/60 bg-white/70 px-4 py-3 text-center text-sm text-amber-950 dark:border-amber-800 dark:bg-zinc-950/40 dark:text-amber-100"
          role="status"
        >
          {subscriptionSummary.expired
            ? "Your subscription has expired."
            : `Your subscription ends ${new Date(subscriptionSummary.periodEnd).toLocaleDateString("en-US", { dateStyle: "medium" })}.`}{" "}
          Renew below to keep full access.
        </p>
      ) : null}

      <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center">
        {unlockEnabled ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void handleUnlock()}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy === "unlock"
              ? "Confirming…"
              : `Unlock this post · ${unlockPriceUsdc} USDC`}
          </button>
        ) : (
          <p className="text-center text-xs text-zinc-500">
            Per-post unlock is not configured.
          </p>
        )}

        {showSubscribe && subscriptionPlans.length > 0 ? (
          <div className="flex flex-col items-center gap-2 sm:items-stretch">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Subscribe to this writer
              <select
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={selectedPlan}
                onChange={(e) =>
                  setSelectedPlan(e.target.value as SubscriptionPlan)
                }
                disabled={busy !== null}
              >
                {subscriptionPlans.map((plan) => (
                  <option key={plan.plan} value={plan.plan}>
                    ${plan.priceUsdc} / {plan.periodDays} days
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy !== null || !payToSplitAddress}
              onClick={() => void handleSubscribe()}
              className="rounded-full border border-zinc-900 px-6 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-60 dark:border-zinc-100 dark:text-zinc-100"
            >
              {busy === "subscribe" ? "Confirming…" : "Subscribe with USDC"}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 text-center text-sm text-emerald-700 dark:text-emerald-400">
          {success}
        </p>
      ) : null}
    </section>
  );
}
