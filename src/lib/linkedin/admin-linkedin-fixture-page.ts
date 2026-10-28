/** Gate for `/admin/linkedin-connect-fixture` — dev-only PR screenshots. */
export function isAdminLinkedInConnectFixturePageEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  return process.env.ADMIN_LINKEDIN_CONNECT_FIXTURE?.trim().toLowerCase() === "true";
}
