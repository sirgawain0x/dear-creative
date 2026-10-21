import { notFound } from "next/navigation";
import {
  ADMIN_PAYOUTS_FIXTURE_SNAPSHOT,
  isAdminPayoutsFixtureEnabled,
} from "@/lib/admin/payouts-fixture";
import { AdminPayoutsCardStatic } from "../admin-payouts-card-static";
import { ADMIN_PAYOUTS_PRIVY_SIGN_IN_NOTE } from "../admin-payouts-section";

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function AdminPayoutsFixturePage({ searchParams }: PageProps) {
  if (!isAdminPayoutsFixtureEnabled()) {
    notFound();
  }

  const { view } = await searchParams;
  const isPrivyAdmin = view === "privy-admin";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Admin payouts preview (fixture)
        </p>
        <h1 className="text-xl font-bold">
          {isPrivyAdmin
            ? "Privy admin — payouts card"
            : "Studio key — sign-in note"}
        </h1>
      </div>
      {isPrivyAdmin ? (
        <AdminPayoutsCardStatic data={ADMIN_PAYOUTS_FIXTURE_SNAPSHOT} />
      ) : (
        <p
          className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
          data-testid="admin-payouts-privy-sign-in-note"
        >
          {ADMIN_PAYOUTS_PRIVY_SIGN_IN_NOTE}
        </p>
      )}
    </main>
  );
}
