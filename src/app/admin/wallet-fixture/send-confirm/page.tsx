import { notFound } from "next/navigation";
import { AdminWalletSendConfirmFixtureClient } from "./send-confirm-fixture-client";
import { isWalletReadFixtureEnabled } from "@/lib/wallet/asset-transfers";

export default function AdminWalletSendConfirmFixturePage() {
  if (!isWalletReadFixtureEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-[390px] px-4 py-8 sm:max-w-none lg:max-w-[1440px]">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Admin wallet send confirm (fixture)
      </p>
      <AdminWalletSendConfirmFixtureClient />
    </main>
  );
}
