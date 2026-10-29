"use client";

import { AdminLinkedInConnect } from "../admin-linkedin-connect";

export function LinkedInConnectFixtureClient() {
  return (
    <AdminLinkedInConnect
      isAdmin={true}
      isSignedIn={true}
      getAccessToken={async () => null}
    />
  );
}
