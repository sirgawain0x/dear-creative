"use client";

import type { AdminPayoutsSnapshot } from "@/lib/admin/admin-payouts";
import { AdminPayoutsCard } from "./admin-payouts-card";

export const ADMIN_PAYOUTS_PRIVY_SIGN_IN_NOTE =
  "Sign in with Privy to view payouts";

type AdminPayoutsSectionProps = {
  session: { userId: string; isAdmin: boolean } | null;
  isSignedIn: boolean;
  authenticated: boolean;
  hasStudioToken: boolean;
  /** When set, renders static payout data (fixture screenshots) instead of fetching. */
  fixtureSnapshot?: AdminPayoutsSnapshot | null;
};

export function AdminPayoutsSection({
  session,
  isSignedIn,
  authenticated,
  hasStudioToken,
  fixtureSnapshot,
}: AdminPayoutsSectionProps) {
  if (session?.isAdmin) {
    if (fixtureSnapshot) {
      return (
        <AdminPayoutsCard fixtureSnapshot={fixtureSnapshot} skipFetch />
      );
    }
    return <AdminPayoutsCard />;
  }

  if (
    isSignedIn &&
    !session?.isAdmin &&
    !authenticated &&
    hasStudioToken
  ) {
    return (
      <p
        className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
        data-testid="admin-payouts-privy-sign-in-note"
      >
        {ADMIN_PAYOUTS_PRIVY_SIGN_IN_NOTE}
      </p>
    );
  }

  return null;
}
