import { notFound } from "next/navigation";
import { isAdminWalletFixturePageEnabled } from "@/lib/wallet/admin-wallet-fixture-page";
import { AdminWalletSwapPendingFixtureClient } from "./swap-pending-fixture-client";

export default function AdminWalletSwapPendingFixturePage() {
  if (!isAdminWalletFixturePageEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminWalletSwapPendingFixtureClient />
    </main>
  );
}
