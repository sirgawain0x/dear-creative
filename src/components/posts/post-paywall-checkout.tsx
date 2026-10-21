"use client";

import { useCallback, useState } from "react";
import { encodeFunctionData, erc20Abi, type Address } from "viem";
import { useSendTransaction } from "@privy-io/react-auth";
import { useAuthSession } from "@/components/providers/app-providers";

export type PostPaywallCheckoutProps = {
  title: string;
  postSlug: string;
  payToSplitAddress: string | null;
  unlockPriceUsdc: number;
  unlockAmountRaw: string;
  showUnlockProtocolSubscribeOffer: boolean;
  chainId: number;
  tokenAddress: string;
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
  payToSplitAddress,
  unlockPriceUsdc,
  unlockAmountRaw,
  showUnlockProtocolSubscribeOffer,
  chainId,
  tokenAddress,
}: PostPaywallCheckoutProps) {
  const { authenticated, login, getAccessToken, privyConfigured } =
    useAuthSession();
  const { sendTransaction } = useSendTransaction();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const unlockEnabled = Boolean(unlockAmountRaw && payToSplitAddress);

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
    setBusy(true);
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
      setBusy(false);
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
        Unlock this post with a one-time USDC payment on Base. Pay directly to
        the writer&apos;s split with your Privy wallet.
      </p>

      <div className="mt-8 flex flex-col items-center gap-4">
        {unlockEnabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleUnlock()}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy
              ? "Confirming…"
              : `Unlock this post · ${unlockPriceUsdc} USDC`}
          </button>
        ) : (
          <p className="text-center text-xs text-zinc-500">
            Unlock requires a configured writer split payout address.
          </p>
        )}

        {showUnlockProtocolSubscribeOffer ? (
          <p className="max-w-md text-center text-xs text-zinc-600 dark:text-zinc-400">
            Writer subscriptions ($8 / 30 days or $80 / 365 days) will use{" "}
            <strong>Unlock Protocol</strong> with auto-renewal — scope only; see{" "}
            <code className="text-[11px]">docs/paywall/unlock-subscriptions-scope.md</code>.
          </p>
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
