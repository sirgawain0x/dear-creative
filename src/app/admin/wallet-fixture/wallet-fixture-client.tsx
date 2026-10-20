"use client";

import { AdminWalletPanel } from "@/components/admin/admin-wallet-panel";
import type { AdminWalletPreviewData } from "@/components/admin/admin-wallet-panel";

export function WalletFixtureClient({
  previewData,
}: {
  previewData: AdminWalletPreviewData;
}) {
  return (
    <AdminWalletPanel walletEnabled previewData={previewData} />
  );
}
