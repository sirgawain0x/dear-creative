import { notFound } from "next/navigation";
import { isReaderWalletFixturePageEnabled } from "@/lib/wallet/reader-wallet-fixture-page";
import { SiteHeaderFixtureClient } from "./site-header-fixture-client";

export default function SiteHeaderFixturePage() {
  if (!isReaderWalletFixturePageEnabled()) {
    notFound();
  }

  return <SiteHeaderFixtureClient showAdmin={false} />;
}
