"use client";

import { getAddress } from "viem";
import { AdminWalletSendForm } from "@/components/admin/admin-wallet-send-form";

/** Opens send UI directly on confirm step for screenshot fixtures. */
export function AdminWalletSendConfirmFixtureClient() {
  return (
    <AdminWalletSendForm
      walletAddress={getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6")}
      isAdmin
      walletSendEnabled
      getAccessToken={async () => null}
      privyConfigured={false}
      authenticated={false}
      previewMode
      fixtureInitialStep="confirm"
    />
  );
}
