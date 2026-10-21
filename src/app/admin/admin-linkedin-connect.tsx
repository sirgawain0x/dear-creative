"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { linkedInCallbackReasonMessage } from "@/lib/linkedin/callback-reason-message";

type AdminLinkedInConnectProps = {
  isAdmin: boolean;
  getAccessToken: () => Promise<string | null>;
};

type LinkedInStatusResponse = {
  connected: boolean;
  memberName?: string;
  expiresAt?: string;
};

export function AdminLinkedInConnect({
  isAdmin,
  getAccessToken,
}: AdminLinkedInConnectProps) {
  const searchParams = useSearchParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [status, setStatus] = useState<LinkedInStatusResponse | null>(null);

  const linkedinParam = searchParams?.get("linkedin") ?? null;
  const callbackError =
    linkedinParam === "error"
      ? (linkedInCallbackReasonMessage(searchParams?.get("reason")) ??
        "LinkedIn connection failed. Try connecting again.")
      : null;
  const error = actionError ?? callbackError;

  const refreshStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setStatus(null);
        return;
      }
      const response = await fetch("/api/admin/linkedin/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setStatus(null);
        return;
      }
      const body = (await response.json()) as LinkedInStatusResponse;
      setStatus(body);
    } catch {
      setStatus(null);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await refreshStatus();
      if (cancelled) {
        return;
      }
      if (linkedinParam === "connected") {
        await refreshStatus();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, linkedinParam, refreshStatus]);

  const startLinkedInConnect = useCallback(async () => {
    setActionError(null);
    setIsStarting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setActionError("Sign in with Privy before connecting LinkedIn.");
        return;
      }
      const response = await fetch("/api/admin/linkedin/auth", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setActionError("Could not start LinkedIn authorization.");
        return;
      }
      const body = (await response.json()) as { url?: string };
      if (!body.url) {
        setActionError("LinkedIn authorization URL was missing from the server.");
        return;
      }
      window.location.assign(body.url);
    } catch {
      setActionError("Failed to reach the LinkedIn authorization endpoint.");
    } finally {
      setIsStarting(false);
    }
  }, [getAccessToken]);

  if (!isAdmin) {
    return null;
  }

  const isConnected = status?.connected === true;
  const connectLabel = isConnected
    ? isStarting
      ? "Starting…"
      : "Reconnect"
    : isStarting
      ? "Starting…"
      : "Connect LinkedIn";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
      <h3 className="text-sm font-semibold">LinkedIn (G2 personal profile)</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Connect your personal LinkedIn member account for Adam posting. Uses OAuth
        with Privy-admin verification on callback.
      </p>
      {isLoadingStatus ? (
        <p className="mt-4 text-xs text-zinc-500">Checking LinkedIn status…</p>
      ) : isConnected ? (
        <p className="mt-4 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Connected as {status.memberName ?? "LinkedIn member"}
        </p>
      ) : (
        <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">
          Not connected.
        </p>
      )}
      <button
        type="button"
        onClick={() => void startLinkedInConnect()}
        disabled={isStarting || isLoadingStatus}
        className="mt-4 rounded-full bg-[#0a66c2] px-5 py-2 text-xs font-semibold text-white hover:bg-[#004182] disabled:opacity-50"
      >
        {connectLabel}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
