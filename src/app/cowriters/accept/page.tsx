"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { useAuthSession } from "@/components/providers/app-providers";

function AcceptCowriterInviteInner() {
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const { ready, isSignedIn, login, getAccessToken, privyConfigured } =
    useAuthSession();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const acceptInvite = useCallback(async () => {
    if (!token) {
      setError("Missing invite token in URL.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in with Privy to accept this invite.");
        return;
      }
      const res = await fetch("/api/cowriters/accept", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { error?: string; outcome?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not accept invite");
        return;
      }
      setMessage("Invite accepted. You will appear on the post byline once it is published.");
    } catch {
      setError("Could not accept invite");
    } finally {
      setSubmitting(false);
    }
  }, [getAccessToken, token]);

  if (!ready) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold">Accept co-writer invite</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Sign in with the same email or wallet that received this invite. Co-writers
        get byline credit only — no edit access.
      </p>

      {!privyConfigured ? (
        <p className="mt-6 text-sm text-amber-700">
          Privy is not configured on this environment.
        </p>
      ) : !isSignedIn ? (
        <button
          type="button"
          onClick={login}
          className="mt-6 rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Sign in with Privy
        </button>
      ) : (
        <button
          type="button"
          disabled={submitting || !token}
          onClick={() => void acceptInvite()}
          className="mt-6 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Accepting…" : "Accept invite"}
        </button>
      )}

      {message ? (
        <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : null}

      <p className="mt-8 text-sm">
        <Link href="/" className="underline">
          Back to Dear Creative
        </Link>
      </p>
    </div>
  );
}

export default function AcceptCowriterInvitePage() {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-sm">Loading invite…</p>}>
      <AcceptCowriterInviteInner />
    </Suspense>
  );
}
