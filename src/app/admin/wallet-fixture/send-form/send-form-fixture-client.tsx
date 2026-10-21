"use client";

import { getAddress } from "viem";
import { AdminWalletSendForm } from "@/components/admin/admin-wallet-send-form";

export function SendFormFixtureClient() {
  return (
    <AdminWalletSendForm
      walletAddress={getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6")}
      balances={{ eth: { formatted: "0.042" }, usdc: { formatted: "1250.50" } }}
      isAdmin
      walletSendEnabled
      getAccessToken={async () => null}
      privyConfigured={false}
      authenticated={false}
      previewMode
      fixtureInitialStep="form"
    />
  );
}
