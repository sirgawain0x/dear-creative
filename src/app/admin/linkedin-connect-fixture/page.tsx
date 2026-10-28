import { notFound } from "next/navigation";
import { isAdminLinkedInConnectFixturePageEnabled } from "@/lib/linkedin/admin-linkedin-fixture-page";
import { LinkedInConnectFixtureClient } from "./linkedin-connect-fixture-client";

export default function AdminLinkedInConnectFixturePage() {
  if (!isAdminLinkedInConnectFixturePageEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="mb-6 text-lg font-semibold">LinkedIn connect (fixture)</h1>
      <LinkedInConnectFixtureClient />
    </main>
  );
}
