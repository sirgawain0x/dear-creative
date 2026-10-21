"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/components/providers/app-providers";
import { adminApiAuthorizationHeaders } from "@/lib/admin/admin-api-auth";
import type { AdminPayoutsSnapshot } from "@/lib/admin/admin-payouts";
import { AdminPayoutAddressRow } from "./admin-payout-address-row";

type AdminPayoutsCardProps = {
  fixtureSnapshot?: AdminPayoutsSnapshot;
  skipFetch?: boolean;
};

export function AdminPayoutsCard({
  fixtureSnapshot,
  skipFetch = false,
}: AdminPayoutsCardProps = {}) {
  const {
    ready,
    isSignedIn,
    authenticated,
    getAccessToken,
    privyConfigured,
  } = useAuthSession();

  const [data, setData] = useState<AdminPayoutsSnapshot | null>(
    skipFetch ? (fixtureSnapshot ?? null) : null,
  );
  const [loading, setLoading] = useState(!skipFetch);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skipFetch) {
      return;
    }
    if (!ready) {
      return;
    }

    let cancelled = false;

    async function loadPayouts() {
      setLoading(true);
      setError(null);
      setData(null);

      const headers = await adminApiAuthorizationHeaders({
        privyConfigured,
        authenticated,
        getAccessToken,
      });

      if (!isSignedIn || !headers) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/admin/payouts", {
          cache: "no-store",
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to load payouts: ${response.status}`);
        }
        const json = (await response.json()) as AdminPayoutsSnapshot;
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPayouts();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    isSignedIn,
    authenticated,
    getAccessToken,
    privyConfigured,
    skipFetch,
  ]);

  if (!skipFetch && !isSignedIn) {
    return null;
  }

  return (
    <div
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60"
      data-testid="admin-payouts-card"
    >
      <h3 className="text-sm font-semibold">Payouts</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Subscriptions and tips pay into this Split: 90% writer, 10% treasury.
      </p>

      {loading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      ) : error ? (
        <p className="mt-4 text-xs text-red-600">{error}</p>
      ) : data ? (
        <div className="mt-4 space-y-4">
          <AdminPayoutAddressRow
            label="Writer wallet (90%)"
            address={data.payoutWalletAddress}
          />
          <AdminPayoutAddressRow
            label="PullSplit contract"
            address={data.payoutSplitAddress}
          />
          <AdminPayoutAddressRow
            label="Treasury (10%)"
            address={data.treasuryAddress}
          />
        </div>
      ) : null}
    </div>
  );
}
