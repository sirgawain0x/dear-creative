const BYTES32_HEX = /^0x[0-9a-fA-F]{64}$/;
const TX_HASH_HEX = /^0x[0-9a-fA-F]{64}$/;

export function normalizeHex32(value: string): string {
  const trimmed = value.trim();
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return withPrefix.toLowerCase();
}

export function isValidBytes32QuestionId(value: string): boolean {
  return BYTES32_HEX.test(normalizeHex32(value));
}

export function isValidTxHash(value: string): boolean {
  return TX_HASH_HEX.test(normalizeHex32(value));
}

export type OracleIngestInput = {
  questionId: string;
  questionText: string;
  txHash: string;
  slug: string;
};

export type OracleIngestValidationResult =
  | { ok: true; value: OracleIngestInput & { articleSlug: string } }
  | { ok: false; error: string };

export function validateOracleIngestBody(
  body: unknown,
): OracleIngestValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "JSON body required" };
  }

  const record = body as Record<string, unknown>;
  const questionId =
    typeof record.questionId === "string" ? record.questionId.trim() : "";
  const questionText =
    typeof record.questionText === "string" ? record.questionText.trim() : "";
  const txHash = typeof record.txHash === "string" ? record.txHash.trim() : "";
  const slug =
    typeof record.slug === "string"
      ? record.slug.trim()
      : typeof record.articleSlug === "string"
        ? record.articleSlug.trim()
        : "";

  if (!questionId) {
    return { ok: false, error: "questionId is required" };
  }
  if (!isValidBytes32QuestionId(questionId)) {
    return { ok: false, error: "questionId must be a 32-byte hex value (0x + 64 hex chars)" };
  }
  if (!questionText) {
    return { ok: false, error: "questionText is required" };
  }
  if (!txHash) {
    return { ok: false, error: "txHash is required" };
  }
  if (!isValidTxHash(txHash)) {
    return { ok: false, error: "txHash must be a 32-byte hex transaction hash" };
  }
  if (!slug) {
    return { ok: false, error: "slug is required" };
  }

  return {
    ok: true,
    value: {
      questionId: normalizeHex32(questionId),
      questionText,
      txHash: normalizeHex32(txHash),
      slug,
      articleSlug: slug,
    },
  };
}
