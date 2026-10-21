import { createHmac, timingSafeEqual } from "node:crypto";
import { getLinkedInStateSecret } from "./config";

export function signLinkedInStatePayload(payload: string): string {
  const secret = getLinkedInStateSecret();
  if (!secret) {
    throw new Error("linkedin_state_secret_missing");
  }
  const mac = createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyLinkedInStatePayload(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const payload = signed.slice(0, dot);
  const mac = signed.slice(dot + 1);
  const expected = signLinkedInStatePayload(payload);
  const expectedMac = expected.slice(expected.lastIndexOf(".") + 1);
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expectedMac, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  return payload;
}
