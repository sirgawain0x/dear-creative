import { notFound } from "next/navigation";
import { isWalletReadFixtureEnabled } from "@/lib/wallet/asset-transfers";
import { SendFormFixtureClient } from "./send-form-fixture-client";

export default function AdminWalletSendFormFixturePage() {
  if (!isWalletReadFixtureEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-[390px] px-4 py-8 sm:max-w-none lg:max-w-[1440px]">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Admin wallet send form (fixture)
      </p>
      <SendFormFixtureClient />
    </main>
  );
}
