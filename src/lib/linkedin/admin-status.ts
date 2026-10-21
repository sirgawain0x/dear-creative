import type { StoredLinkedInCredentials } from "./token-store";

export type LinkedInAdminConnectionStatus = {
  connected: boolean;
  memberName?: string;
  expiresAt?: string;
};

export function toLinkedInAdminConnectionStatus(
  creds: StoredLinkedInCredentials | null,
): LinkedInAdminConnectionStatus {
  if (!creds) {
    return { connected: false };
  }
  const status: LinkedInAdminConnectionStatus = { connected: true };
  const memberName = creds.memberDisplayName?.trim();
  if (memberName) {
    status.memberName = memberName;
  }
  if (creds.expiresAtMs != null) {
    status.expiresAt = new Date(creds.expiresAtMs).toISOString();
  }
  return status;
}
