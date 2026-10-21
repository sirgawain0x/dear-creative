import { notFound } from "next/navigation";
import { isReaderWalletFixturePageEnabled } from "@/lib/wallet/reader-wallet-fixture-page";
import { AccountDropdownFixtureClient } from "./account-dropdown-fixture-client";

export default function AccountDropdownFixturePage() {
  if (!isReaderWalletFixturePageEnabled()) {
    notFound();
  }

  return <AccountDropdownFixtureClient />;
}
