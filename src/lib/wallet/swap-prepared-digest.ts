import { createHash } from "node:crypto";

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(record[k])}`).join(",")}}`;
}

export function hashPreparedForSeal(prepared: unknown): string {
  const body = stableJson(prepared);
  return createHash("sha256").update(body).digest("hex");
}

export function hashSignatureRequestForSeal(signatureRequest: unknown): string {
  const body = stableJson(signatureRequest);
  return createHash("sha256").update(body).digest("hex");
}
