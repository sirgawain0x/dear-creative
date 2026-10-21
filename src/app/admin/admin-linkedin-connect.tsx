"use client";

import { useCallback, useState } from "react";

type AdminLinkedInConnectProps = {
  isAdmin: boolean;
  getAccessToken: () => Promise<string | null>;
};

export function AdminLinkedInConnect({
  isAdmin,
  getAccessToken,
}: AdminLinkedInConnectProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const startLinkedInConnect = useCallback(async () => {
    setError(null);
    setIsStarting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Sign in with Privy before connecting LinkedIn.");
        return;
      }
      const response = await fetch("/api/admin/linkedin/auth", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setError("Could not start LinkedIn authorization.");
        return;
      }
      const body = (await response.json()) as { url?: string };
      if (!body.url) {
        setError("LinkedIn authorization URL was missing from the server.");
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Failed to reach the LinkedIn authorization endpoint.");
    } finally {
      setIsStarting(false);
    }
  }, [getAccessToken]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
      <h3 className="text-sm font-semibold">LinkedIn (G2 personal profile)</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Connect your personal LinkedIn member account for Adam posting. Uses OAuth
        with Privy-admin verification on callback.
      </p>
      <button
        type="button"
        onClick={() => void startLinkedInConnect()}
        disabled={isStarting}
        className="mt-4 rounded-full bg-[#0a66c2] px-5 py-2 text-xs font-semibold text-white hover:bg-[#004182] disabled:opacity-50"
      >
        {isStarting ? "Starting…" : "Connect LinkedIn"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
