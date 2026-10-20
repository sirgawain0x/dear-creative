import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getLinkedInTokenEncryptionKey } from "./config";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export function encryptSecret(plaintext: string): string {
  const key = getLinkedInTokenEncryptionKey();
  if (!key) {
    throw new Error("linkedin_encryption_key_missing");
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(
    ":",
  );
}

export function decryptSecret(payload: string): string {
  const key = getLinkedInTokenEncryptionKey();
  if (!key) {
    throw new Error("linkedin_encryption_key_missing");
  }
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("linkedin_ciphertext_invalid");
  }
  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const ciphertext = Buffer.from(parts[3]!, "base64url");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}

export function signOAuthState(payload: string): string {
  const key = getLinkedInTokenEncryptionKey();
  if (!key) {
    throw new Error("linkedin_encryption_key_missing");
  }
  const mac = createHmac("sha256", key).update(payload, "utf8").digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyOAuthState(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const payload = signed.slice(0, dot);
  const mac = signed.slice(dot + 1);
  const expected = signOAuthState(payload);
  const expectedMac = expected.slice(expected.lastIndexOf(".") + 1);
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expectedMac, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  return payload;
}
