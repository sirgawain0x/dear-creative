"use client";

import { AdminWalletSwapForm } from "@/components/admin/admin-wallet-swap-form";

export function AdminWalletSwapPendingFixtureClient() {
  return (
    <AdminWalletSwapForm
      walletAddress="0xAE48B6dB64772b9CC24e33A79c809896776a20f6"
      isAdmin
      walletSwapEnabled
      getAccessToken={async () => null}
      privyConfigured={false}
      authenticated={false}
      previewMode
      fixtureInitialStep="pending"
    />
  );
}
