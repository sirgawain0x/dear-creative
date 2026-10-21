import { notFound } from "next/navigation";
import { isWalletReadFixtureEnabled } from "@/lib/wallet/asset-transfers";
import { AdminWalletSwapSuccessFixtureClient } from "./swap-success-fixture-client";

export default function AdminWalletSwapSuccessFixturePage() {
  if (!isWalletReadFixtureEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminWalletSwapSuccessFixtureClient />
    </main>
  );
}
