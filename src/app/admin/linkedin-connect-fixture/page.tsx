import { notFound } from "next/navigation";
import { AdminLinkedInConnect } from "../admin-linkedin-connect";
import { isAdminLinkedInConnectFixturePageEnabled } from "@/lib/linkedin/admin-linkedin-fixture-page";

export default function AdminLinkedInConnectFixturePage() {
  if (!isAdminLinkedInConnectFixturePageEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="mb-6 text-lg font-semibold">LinkedIn connect (fixture)</h1>
      <AdminLinkedInConnect isAdmin={true} isSignedIn={true} />
    </main>
  );
}
