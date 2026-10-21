import { notFound } from "next/navigation";
import {
  ADMIN_PAYOUTS_FIXTURE_SNAPSHOT,
  isAdminPayoutsFixtureEnabled,
} from "@/lib/admin/payouts-fixture";
import { AdminPayoutsSection } from "../admin-payouts-section";

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
          {isPrivyAdmin ? "Privy admin — payouts card" : "Studio key — sign-in note"}
        </h1>
      </div>
      <AdminPayoutsSection
        session={isPrivyAdmin ? { userId: "did:privy:fixture", isAdmin: true } : null}
        isSignedIn
        authenticated={isPrivyAdmin}
        hasStudioToken={!isPrivyAdmin}
        fixtureSnapshot={
          isPrivyAdmin ? ADMIN_PAYOUTS_FIXTURE_SNAPSHOT : undefined
        }
      />
    </main>
  );
}
