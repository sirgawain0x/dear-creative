import { randomBytes } from "node:crypto";
import { signOAuthState, verifyOAuthState } from "./crypto";

const STATE_TTL_MS = 15 * 60 * 1000;

export function createLinkedInOAuthState(nowMs = Date.now()): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${nowMs}:${nonce}`;
  return signOAuthState(payload);
}

export function validateLinkedInOAuthState(
  state: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!state?.trim()) {
    return false;
  }
  const payload = verifyOAuthState(state.trim());
  if (!payload) {
    return false;
  }
  const [issuedAtRaw] = payload.split(":");
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) {
    return false;
  }
  return nowMs - issuedAt >= 0 && nowMs - issuedAt <= STATE_TTL_MS;
}
