import { eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { getDb } from "@/db/client";
import { linkedinMemberCredentials } from "@/db/schema";
import { LINKEDIN_PERSONAL_CREDENTIAL_ID } from "./config";
import { decryptSecret, encryptSecret } from "./crypto";
import { LinkedInReauthRequiredError } from "./errors";
import { memberSubToPersonUrn } from "./member-urn";

export type StoredLinkedInCredentials = {
  id: string;
  memberSub: string;
  memberDisplayName: string | null;
  authorUrn: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAtMs: number | null;
};

export type SaveLinkedInTokenInput = {
  memberSub: string;
  memberDisplayName?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds?: number;
  nowMs?: number;
};

let dbOverride: DearCreativeDb | undefined;

export function setLinkedInDbForTests(db: DearCreativeDb | undefined): void {
  dbOverride = db;
}

function resolveDb(): DearCreativeDb {
  return dbOverride ?? getDb();
}

export async function saveLinkedInPersonalCredentials(
  input: SaveLinkedInTokenInput,
): Promise<void> {
  const db = resolveDb();
  const nowMs = input.nowMs ?? Date.now();
  const expiresAtMs =
    input.expiresInSeconds != null
      ? nowMs + input.expiresInSeconds * 1000
      : null;
  const authorUrn = memberSubToPersonUrn(input.memberSub);
  const memberDisplayName = input.memberDisplayName?.trim() || null;
  await db
    .insert(linkedinMemberCredentials)
    .values({
      id: LINKEDIN_PERSONAL_CREDENTIAL_ID,
      memberSub: input.memberSub,
      memberDisplayName,
      authorUrn,
      accessTokenEnc: encryptSecret(input.accessToken),
      refreshTokenEnc: input.refreshToken
        ? encryptSecret(input.refreshToken)
        : null,
      expiresAt: expiresAtMs != null ? new Date(expiresAtMs) : null,
      updatedAt: new Date(nowMs),
    })
    .onConflictDoUpdate({
      target: linkedinMemberCredentials.id,
      set: {
        memberSub: input.memberSub,
        memberDisplayName,
        authorUrn,
        accessTokenEnc: encryptSecret(input.accessToken),
        refreshTokenEnc: input.refreshToken
          ? encryptSecret(input.refreshToken)
          : null,
        expiresAt: expiresAtMs != null ? new Date(expiresAtMs) : null,
        updatedAt: new Date(nowMs),
      },
    });
}

export async function loadLinkedInPersonalCredentials(): Promise<StoredLinkedInCredentials | null> {
  const db = resolveDb();
  const row = await db.query.linkedinMemberCredentials.findFirst({
    where: eq(linkedinMemberCredentials.id, LINKEDIN_PERSONAL_CREDENTIAL_ID),
  });
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    memberSub: row.memberSub,
    memberDisplayName: row.memberDisplayName ?? null,
    authorUrn: row.authorUrn,
    accessToken: decryptSecret(row.accessTokenEnc),
    refreshToken: row.refreshTokenEnc
      ? decryptSecret(row.refreshTokenEnc)
      : null,
    expiresAtMs: row.expiresAt ? row.expiresAt.getTime() : null,
  };
}

export function assertLinkedInAccessTokenValid(
  creds: StoredLinkedInCredentials,
  nowMs = Date.now(),
): void {
  if (creds.expiresAtMs != null && nowMs >= creds.expiresAtMs) {
    throw new LinkedInReauthRequiredError();
  }
}
