import { notFound } from "next/navigation";
import { isWalletReadFixtureEnabled } from "@/lib/wallet/asset-transfers";
import { AdminWalletSwapPendingFixtureClient } from "./swap-pending-fixture-client";

export default function AdminWalletSwapPendingFixturePage() {
  if (!isWalletReadFixtureEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminWalletSwapPendingFixtureClient />
    </main>
  );
}
