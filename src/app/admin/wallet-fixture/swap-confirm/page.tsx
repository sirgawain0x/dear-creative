import { notFound } from "next/navigation";
import { isWalletReadFixtureEnabled } from "@/lib/wallet/asset-transfers";
import { AdminWalletSwapConfirmFixtureClient } from "./swap-confirm-fixture-client";

export default function AdminWalletSwapConfirmFixturePage() {
  if (!isWalletReadFixtureEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminWalletSwapConfirmFixtureClient />
    </main>
  );
}
