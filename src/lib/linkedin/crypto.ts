import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
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
