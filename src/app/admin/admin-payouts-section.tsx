"use client";

import type { AdminPayoutsSnapshot } from "@/lib/admin/admin-payouts";
import type { AdminMeSession } from "./admin-session";
import { AdminPayoutsCard } from "./admin-payouts-card";

export const ADMIN_PAYOUTS_PRIVY_SIGN_IN_NOTE =
  "Sign in with Privy to view payouts";

type AdminPayoutsSectionProps = {
  session: AdminMeSession | null;
  isSignedIn: boolean;
  authenticated: boolean;
  /** When set, renders static payout data (fixture screenshots) instead of fetching. */
  fixtureSnapshot?: AdminPayoutsSnapshot | null;
};

function AdminPayoutsPrivySignInNote() {
  return (
    <p
      className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
      data-testid="admin-payouts-privy-sign-in-note"
    >
      {ADMIN_PAYOUTS_PRIVY_SIGN_IN_NOTE}
    </p>
  );
}

export function AdminPayoutsSection({
  session,
  isSignedIn,
  authenticated,
  fixtureSnapshot,
}: AdminPayoutsSectionProps) {
  const showPrivyAdminCard =
    authenticated && session?.mode === "privy_admin";

  if (showPrivyAdminCard) {
    if (fixtureSnapshot) {
      return (
        <AdminPayoutsCard fixtureSnapshot={fixtureSnapshot} skipFetch />
      );
    }
    return <AdminPayoutsCard />;
  }

  const showPrivySignInNote =
    isSignedIn &&
    (!authenticated || session?.mode === "adam_token");

  if (showPrivySignInNote) {
    return <AdminPayoutsPrivySignInNote />;
  }

  return null;
}
