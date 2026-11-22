"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuthSession } from "@/components/providers/app-providers";
import type { StudioMembershipSummary } from "@/lib/adam/studio-access-server";
import type { StudioAccessDenial } from "@/lib/adam/studio-access";
import { shortenAddress } from "@/lib/wallet/short-address";

type LockedReason = StudioAccessDenial["reason"];

const COPY: Record<LockedReason, { title: string; body: string }> = {
  signed_out: {
    title: "Sign in to open Adam Studio",
    body: "Adam Studio is the owner's private editorial tool. Sign in with the wallet that holds a Creative Creator Pass, or with an allowlisted wallet.",
  },
  no_linked_wallet: {
    title: "Link a wallet to continue",
    body: "Your account is signed in but has no wallet linked. Link the wallet that holds your Creative Creator Pass, then reload this page.",
  },
  not_a_member: {
    title: "This account has no studio access",
    body: "Adam Studio is currently limited to the owner. A valid Creative Creator Pass — or a wallet on the Studio allowlist — unlocks it.",
  },
};

/**
 * Rendered by /adam when the server gate denies access. Keeps the Studio Key
 * fallback (ADAM_API_TOKEN) for machines without a Privy session.
 */
export function AdamStudioLocked({
  reason,
  membership,
}: {
  reason: LockedReason;
  membership: StudioMembershipSummary;
}) {
  const router = useRouter();
  const { setStudioToken } = useAuthSession();
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [studioKey, setStudioKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const copy = COPY[reason];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = studioKey.trim();
    if (!token) {
      setError("Enter the ADAM_API_TOKEN configured for this deployment.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/adam/studio-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        setError("That key didn't match ADAM_API_TOKEN.");
        return;
      }
      // Keep the existing localStorage bearer path working for studio API calls.
      setStudioToken(token);
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-3xl shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        🔒
      </div>

      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        <span>Private editorial studio</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {copy.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {copy.body}
      </p>

      {reason === "not_a_member" ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
          {membership.checked && !membership.active
            ? "No active Creative Creator Pass was found on your linked wallets."
            : "This account is not on the Studio allowlist."}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/admin"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Sign In
        </Link>
        <button
          type="button"
          onClick={() => {
            setShowKeyForm((open) => !open);
            setError(null);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span aria-hidden="true">🔑</span>
          <span>Enter Studio Key</span>
        </button>
      </div>

      {showKeyForm ? (
        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-6 max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <label
            htmlFor="adam-studio-key-input"
            className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            ADAM_API_TOKEN
          </label>
          <input
            id="adam-studio-key-input"
            type="password"
            autoComplete="off"
            value={studioKey}
            onChange={(event) => setStudioKey(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder="Paste your Studio Key"
          />
          {error ? (
            <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="mt-3 w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? "Checking…" : "Unlock Studio"}
          </button>
        </form>
      ) : null}

      <dl className="mx-auto mt-8 max-w-sm space-y-1 border-t border-zinc-200 pt-6 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        <div className="flex items-center justify-between gap-4">
          <dt>Pass</dt>
          <dd className="font-medium text-zinc-700 dark:text-zinc-300">
            {membership.lockName}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Network</dt>
          <dd className="font-medium text-zinc-700 dark:text-zinc-300">
            Base · chain {membership.chainId}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Lock</dt>
          <dd className="font-mono text-zinc-700 dark:text-zinc-300">
            {shortenAddress(membership.lockAddress, 6)}
          </dd>
        </div>
      </dl>

      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
        >
          ← Return to Dear Creative
        </Link>
      </div>
    </div>
  );
}
