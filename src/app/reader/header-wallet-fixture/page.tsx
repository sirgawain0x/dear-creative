import { notFound } from "next/navigation";
import { isReaderWalletFixturePageEnabled } from "@/lib/wallet/reader-wallet-fixture-page";
import { HeaderWalletFixtureClient } from "./header-wallet-fixture-client";

export default function HeaderWalletFixturePage() {
  if (!isReaderWalletFixturePageEnabled()) {
    notFound();
  }

  return <HeaderWalletFixtureClient />;
}
