import { describe, expect, it } from "vitest";
import {
  isValidBytes32QuestionId,
  isValidTxHash,
  validateOracleIngestBody,
} from "./ingest-validation";

describe("ingest-validation", () => {
  it("accepts normalized bytes32 question ids and tx hashes", () => {
    const id =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const tx =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expect(isValidBytes32QuestionId(id)).toBe(true);
    expect(isValidTxHash(tx)).toBe(true);
  });

  it("rejects invalid hex lengths", () => {
    expect(isValidBytes32QuestionId("0xabc")).toBe(false);
    expect(isValidTxHash("0xabc")).toBe(false);
  });

  it("validates ingest payload fields", () => {
    const result = validateOracleIngestBody({
      questionId:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      questionText: "Will this resolve?",
      txHash:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      slug: "demo-post",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.questionId.startsWith("0x")).toBe(true);
      expect(result.value.articleSlug).toBe("demo-post");
    }
  });
});
