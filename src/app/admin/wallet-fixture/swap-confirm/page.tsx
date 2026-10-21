import { notFound } from "next/navigation";
import { isAdminWalletFixturePageEnabled } from "@/lib/wallet/admin-wallet-fixture-page";
import { AdminWalletSwapConfirmFixtureClient } from "./swap-confirm-fixture-client";

export default function AdminWalletSwapConfirmFixturePage() {
  if (!isAdminWalletFixturePageEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminWalletSwapConfirmFixtureClient />
    </main>
  );
}
