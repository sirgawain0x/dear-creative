import { randomBytes } from "node:crypto";
import {
  signLinkedInStatePayload,
  verifyLinkedInStatePayload,
} from "./state-crypto";

const STATE_TTL_MS = 15 * 60 * 1000;
const PAYLOAD_SEP = "|";

export type ParsedLinkedInOAuthState = {
  expiresAtMs: number;
  privyUserId: string;
  nonce: string;
};

export function createLinkedInOAuthState(
  privyUserId: string,
  nowMs = Date.now(),
): string {
  const expiresAtMs = nowMs + STATE_TTL_MS;
  const nonce = randomBytes(16).toString("hex");
  const payload = [String(expiresAtMs), privyUserId, nonce].join(PAYLOAD_SEP);
  return signLinkedInStatePayload(payload);
}

export function parseLinkedInOAuthState(
  state: string | null | undefined,
): ParsedLinkedInOAuthState | null {
  if (!state?.trim()) {
    return null;
  }
  const payload = verifyLinkedInStatePayload(state.trim());
  if (!payload) {
    return null;
  }
  const parts = payload.split(PAYLOAD_SEP);
  if (parts.length !== 3) {
    return null;
  }
  const expiresAtMs = Number(parts[0]);
  const privyUserId = parts[1]?.trim();
  const nonce = parts[2]?.trim();
  if (!Number.isFinite(expiresAtMs) || !privyUserId || !nonce) {
    return null;
  }
  return { expiresAtMs, privyUserId, nonce };
}

export function validateLinkedInOAuthStateForUser(
  state: string | null | undefined,
  privyUserId: string,
  nowMs = Date.now(),
): boolean {
  const parsed = parseLinkedInOAuthState(state);
  if (!parsed) {
    return false;
  }
  if (nowMs > parsed.expiresAtMs) {
    return false;
  }
  return parsed.privyUserId === privyUserId;
}
