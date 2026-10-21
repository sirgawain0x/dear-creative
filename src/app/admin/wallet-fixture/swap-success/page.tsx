"use client";

import { AdminWalletSwapForm } from "@/components/admin/admin-wallet-swap-form";

export default function AdminWalletSwapSuccessFixturePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminWalletSwapForm
        walletAddress="0xAE48B6dB64772b9CC24e33A79c809896776a20f6"
        isAdmin
        walletSwapEnabled
        getAccessToken={async () => null}
        privyConfigured={false}
        authenticated={false}
        previewMode
        fixtureInitialStep="success"
      />
    </main>
  );
}
