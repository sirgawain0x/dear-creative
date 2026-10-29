"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminEarnPanel } from "@/components/admin/admin-earn-panel";
import { AdminWalletPanel } from "@/components/admin/admin-wallet-panel";
import { OracleIngestForm } from "@/components/admin/oracle-ingest-form";
import { useAuthSession } from "@/components/providers/app-providers";
import { AdminLinkedInConnect } from "./admin-linkedin-connect";

import type { AdminMeSession } from "./admin-session";
import { AdminPayoutsSection } from "./admin-payouts-section";
import { resolveStudioBearerToken } from "@/lib/admin/studio-bearer-token";

export { ADMIN_PAYOUTS_PRIVY_SIGN_IN_NOTE } from "./admin-payouts-section";

export const ADMIN_OWNER_TOOL_LINKS = [
  {
    href: "/adam",
    title: "Studio →",
    description: "Multimodal agent & drafts",
  },
  {
    href: "/approvals",
    title: "Approvals Queue →",
    description: "Review before dispatching",
  },
  {
    href: "/adam?tab=posts",
    title: "Manage Posts →",
    description: "Edit & Lens Grove banners",
  },
  {
    href: "/admin/metrics",
    title: "Metrics →",
    description: "Subscribers, delivery, and tips",
  },
] as const;

export function AdminConsole() {
  const {
    ready,
    isSignedIn,
    user,
    getAccessToken,
    privyConfigured,
    authenticated,
  } = useAuthSession();

  const [session, setSession] = useState<AdminMeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [walletSendEnabled, setWalletSendEnabled] = useState(false);
  const [earnEnabled, setEarnEnabled] = useState(false);
  const [earnActionsEnabled, setEarnActionsEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) {
          if (typeof json.walletEnabled === "boolean") {
            setWalletEnabled(json.walletEnabled);
          }
          if (typeof json.walletSendEnabled === "boolean") {
            setWalletSendEnabled(json.walletSendEnabled);
          }
          if (typeof json.earnEnabled === "boolean") {
            setEarnEnabled(json.earnEnabled);
          }
          if (typeof json.earnActionsEnabled === "boolean") {
            setEarnActionsEnabled(json.earnActionsEnabled);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshSession = useCallback(async (options?: { silent?: boolean }) => {
    setError(null);
    if (!options?.silent) {
      setIsVerifying(true);
    }
    try {
      const token = await resolveStudioBearerToken({
        privyConfigured,
        authenticated,
        getAccessToken,
      });
      if (!token) {
        setSession(null);
        setError("No access token available. Please sign in first.");
        return;
      }
      const response = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setSession(null);
        setError("Could not verify admin session. Ensure your Privy DID is in PRIVY_ADMIN_USER_IDS.");
        return;
      }
      setSession((await response.json()) as AdminMeSession);
    } catch {
      setError("Failed to verify session with server.");
    } finally {
      if (!options?.silent) {
        setIsVerifying(false);
      }
    }
  }, [authenticated, getAccessToken, privyConfigured]);

  useEffect(() => {
    if (!ready || !authenticated) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void refreshSession({ silent: true });
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ready, authenticated, refreshSession]);

  if (!ready) {
    return <p className="text-zinc-500">Loading authentication status…</p>;
  }

  return (
    <div className="space-y-6">
      {/* Auth Status Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Current Session
            </span>
            <h2 className="mt-1 text-lg font-bold">
              {isSignedIn ? "Signed In" : "Signed Out"}
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isSignedIn
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isSignedIn ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
              }`}
            />
            {isSignedIn ? "Owner Session Active" : "Unauthenticated"}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {!privyConfigured ? (
            <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold">
                Privy is not configured (<code>NEXT_PUBLIC_PRIVY_APP_ID</code> is
                unset).
              </p>
              <p>
                You can authenticate using your <code>ADAM_API_TOKEN</code> Studio Key directly on{" "}
                <Link href="/adam" className="font-bold underline">
                  Studio
                </Link>.
              </p>
            </div>
          ) : !isSignedIn ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Use <span className="font-semibold text-zinc-900 dark:text-zinc-100">Sign In</span> in
              the site header to authenticate with Privy (email, wallet, or social).
            </p>
          ) : (
            <div className="space-y-4">
              {user ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-950">
                  <span className="font-semibold text-zinc-500">
                    Privy User ID (DID):
                  </span>{" "}
                  <code className="select-all font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {user.id}
                  </code>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void refreshSession();
                  }}
                  disabled={isVerifying}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {isVerifying ? "Verifying…" : "Verify Server Token"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isSignedIn ? (
        <div
          className="flex w-full flex-col gap-6"
          data-testid="admin-console-panels-stack"
        >
          <AdminWalletPanel
            walletEnabled={walletEnabled}
            walletSendEnabled={walletSendEnabled}
            isAdmin={Boolean(session?.isAdmin)}
          />
          <AdminEarnPanel
            earnEnabled={earnEnabled}
            earnActionsEnabled={earnActionsEnabled}
          />
        </div>
      ) : null}

      {/* Owner Navigation Links (Gated) */}
      {session?.isAdmin ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <h3 className="text-sm font-semibold">Owner Studio &amp; Tools</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Access private editorial tools unlocked by your active session.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ADMIN_OWNER_TOOL_LINKS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="flex flex-col rounded-xl border border-zinc-200 p-3.5 hover:border-zinc-400 hover:bg-zinc-50 transition dark:border-zinc-800 dark:hover:bg-zinc-800/60"
              >
                <span className="text-sm font-semibold">{tool.title}</span>
                <span className="mt-1 text-[11px] text-zinc-500">
                  {tool.description}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <AdminPayoutsSection
        session={session}
        isSignedIn={isSignedIn}
        authenticated={authenticated}
      />
      {session?.isAdmin ? (
        <AdminLinkedInConnect
          isAdmin={session.isAdmin}
          isSignedIn={isSignedIn}
          getAccessToken={getAccessToken}
        />
      ) : null}
      {session?.isAdmin ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <h3 className="text-sm font-semibold">Oracle ingest</h3>
          <OracleIngestForm getAccessToken={getAccessToken} />
        </div>
      ) : null}
      {session ? (
        <pre className="rounded-xl bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
          {JSON.stringify(session, null, 2)}
        </pre>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
