import { vi } from "vitest";

export const TEST_LINKEDIN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
export const TEST_LINKEDIN_STATE_SECRET = Buffer.alloc(32, 3).toString("base64");

export function stubLinkedInOAuthEnv(): void {
  vi.stubEnv("LINKEDIN_CLIENT_ID", "linkedin-client-id");
  vi.stubEnv("LINKEDIN_CLIENT_SECRET", "linkedin-client-secret");
  vi.stubEnv(
    "LINKEDIN_REDIRECT_URI",
    "https://dear.example/api/admin/linkedin/callback",
  );
  vi.stubEnv("LINKEDIN_TOKEN_ENCRYPTION_KEY", TEST_LINKEDIN_ENCRYPTION_KEY);
  vi.stubEnv("LINKEDIN_STATE_SECRET", TEST_LINKEDIN_STATE_SECRET);
  vi.stubEnv("LINKEDIN_API_VERSION", "202601");
}
