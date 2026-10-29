"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  readLinkedInCallbackBanner,
  type LinkedInCallbackBanner,
} from "@/lib/linkedin/read-linkedin-callback-banner";
import { stripLinkedInCallbackSearchParams } from "@/lib/linkedin/strip-linkedin-callback-search-params";

const LINKEDIN_STATUS_CHECK_FAILED_MESSAGE =
  "Couldn't check LinkedIn status.";

type AdminLinkedInConnectProps = {
  isAdmin: boolean;
  isSignedIn: boolean;
  getAccessToken: () => Promise<string | null>;
};

type LinkedInStatusResponse = {
  connected: boolean;
  memberName?: string;
  expiresAt?: string;
};

function connectButtonLabel(isConnected: boolean, isStarting: boolean): string {
  if (isStarting) {
    return "Starting…";
  }
  return isConnected ? "Reconnect" : "Connect LinkedIn";
}

function AdminLinkedInConnectInner({
  isAdmin,
  isSignedIn,
  getAccessToken,
}: AdminLinkedInConnectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [callbackBanner, setCallbackBanner] =
    useState<LinkedInCallbackBanner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [statusLoadFailed, setStatusLoadFailed] = useState(false);
  const [status, setStatus] = useState<LinkedInStatusResponse | null>(null);
  const handledCallbackKeyRef = useRef<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    setStatusLoadFailed(false);
    try {
      const token = await getAccessToken();
      if (!token) {
        setStatus(null);
        setStatusLoadFailed(true);
        return;
      }
      const response = await fetch("/api/admin/linkedin/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setStatus(null);
        setStatusLoadFailed(true);
        return;
      }
      const body = (await response.json()) as LinkedInStatusResponse;
      setStatus(body);
      setStatusLoadFailed(false);
    } catch {
      setStatus(null);
      setStatusLoadFailed(true);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    void (async () => {
      await refreshStatus();
    })();
  }, [isAdmin, refreshStatus]);

  useEffect(() => {
    const linkedin = searchParams.get("linkedin")?.trim();
    if (!linkedin) {
      return;
    }

    const callbackKey = `${linkedin}:${searchParams.get("reason")?.trim() ?? ""}`;
    if (handledCallbackKeyRef.current === callbackKey) {
      return;
    }
    handledCallbackKeyRef.current = callbackKey;

    const banner = readLinkedInCallbackBanner(searchParams);
    if (banner) {
      // Mirror URL params into state, then strip them from the address bar.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- banner must survive router.replace clearing searchParams
      setCallbackBanner(banner);
    }

    const cleanPath = stripLinkedInCallbackSearchParams(
      new URL(window.location.href),
    );
    router.replace(cleanPath, { scroll: false });

    if (linkedin === "connected") {
      void refreshStatus();
    }
  }, [router, searchParams, refreshStatus]);

  const startLinkedInConnect = useCallback(async () => {
    setError(null);
    setCallbackBanner(null);
    if (!isSignedIn) {
      setError("Sign in with Privy before connecting LinkedIn.");
      return;
    }
    setIsStarting(true);
    try {
      const response = await fetch("/api/admin/linkedin/auth", {
        credentials: "include",
      });
      if (response.status === 401) {
        setError("Sign in with Privy before connecting LinkedIn.");
        return;
      }
      if (response.status === 403) {
        setError("Only Privy admins can connect LinkedIn.");
        return;
      }
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
  }, [isSignedIn]);

  if (!isAdmin) {
    return null;
  }

  const isConnected = status?.connected === true;
  const connectLabel = connectButtonLabel(isConnected, isStarting);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
      <h3 className="text-sm font-semibold">LinkedIn (G2 personal profile)</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Connect your personal LinkedIn member account for Adam posting. Uses OAuth
        with Privy-admin verification on callback.
      </p>
      {callbackBanner ? (
        <div
          data-testid="admin-linkedin-callback-banner"
          role="alert"
          className={
            callbackBanner.kind === "success"
              ? "mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          }
        >
          {callbackBanner.message}
        </div>
      ) : null}
      {isLoadingStatus ? (
        <p className="mt-4 text-xs text-zinc-500">Checking LinkedIn status…</p>
      ) : statusLoadFailed ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p
            data-testid="admin-linkedin-status-error"
            className="text-xs text-amber-800 dark:text-amber-200"
          >
            {LINKEDIN_STATUS_CHECK_FAILED_MESSAGE}
          </p>
          <button
            type="button"
            data-testid="admin-linkedin-status-retry"
            onClick={() => void refreshStatus()}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Retry
          </button>
        </div>
      ) : isConnected ? (
        <p className="mt-4 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Connected as {status?.memberName ?? "LinkedIn member"}
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

export function AdminLinkedInConnect(props: AdminLinkedInConnectProps) {
  return (
    <Suspense fallback={null}>
      <AdminLinkedInConnectInner {...props} />
    </Suspense>
  );
}
