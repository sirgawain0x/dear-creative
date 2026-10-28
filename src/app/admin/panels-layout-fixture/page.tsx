import { notFound } from "next/navigation";
import { isAdminWalletFixturePageEnabled } from "@/lib/wallet/admin-wallet-fixture-page";
import { PanelsLayoutFixtureClient } from "./panels-layout-fixture-client";

export default function AdminPanelsLayoutFixturePage() {
  if (!isAdminWalletFixturePageEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin panels layout (fixture)</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Funds (Base) stacked above Earn — same width as production /admin.
        </p>
      </div>
      <PanelsLayoutFixtureClient />
    </main>
  );
}
