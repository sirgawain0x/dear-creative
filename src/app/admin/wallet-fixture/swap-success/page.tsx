import { notFound } from "next/navigation";
import { isAdminWalletFixturePageEnabled } from "@/lib/wallet/admin-wallet-fixture-page";
import { AdminWalletSwapSuccessFixtureClient } from "./swap-success-fixture-client";

export default function AdminWalletSwapSuccessFixturePage() {
  if (!isAdminWalletFixturePageEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminWalletSwapSuccessFixtureClient />
    </main>
  );
}
