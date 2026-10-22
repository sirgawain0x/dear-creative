"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  LINKEDIN_CALLBACK_SUCCESS_MESSAGE,
  linkedInCallbackErrorMessage,
} from "@/lib/linkedin/callback-banner-messages";
import { stripLinkedInCallbackSearchParams } from "@/lib/linkedin/strip-linkedin-callback-search-params";

type AdminLinkedInConnectProps = {
  isAdmin: boolean;
  isSignedIn: boolean;
};

type CallbackBanner =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function AdminLinkedInConnectInner({
  isAdmin,
  isSignedIn,
}: AdminLinkedInConnectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [callbackBanner, setCallbackBanner] = useState<CallbackBanner | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const handledCallbackKeyRef = useRef<string | null>(null);

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

    if (linkedin === "connected") {
      setCallbackBanner({
        kind: "success",
        message: LINKEDIN_CALLBACK_SUCCESS_MESSAGE,
      });
    } else if (linkedin === "error") {
      setCallbackBanner({
        kind: "error",
        message: linkedInCallbackErrorMessage(searchParams.get("reason")),
      });
    }

    const cleanPath = stripLinkedInCallbackSearchParams(
      new URL(window.location.href),
    );
    router.replace(cleanPath, { scroll: false });
  }, [router, searchParams]);

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

export function AdminLinkedInConnect(props: AdminLinkedInConnectProps) {
  return (
    <Suspense fallback={null}>
      <AdminLinkedInConnectInner {...props} />
    </Suspense>
  );
}
