import { describe, expect, it } from "vitest";
import {
  findCreativeTvPredictionLinks,
  normalizePredictionQuestionId,
  parseCreativeTvPredictionUrl,
  resolveTrustedPredictionViewUrl,
} from "./creative-tv-prediction-link";

const Q =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

describe("creative-tv-prediction-link", () => {
  it("accepts tv.creativeplatform.xyz predict URLs", () => {
    const url = `https://tv.creativeplatform.xyz/predict/${Q}`;
    expect(parseCreativeTvPredictionUrl(url)).toEqual({
      questionId: Q,
      viewUrl: url,
      matchedUrl: url,
    });
  });

  it("accepts creative.tv and crtv.xyz hosts", () => {
    const parsed = parseCreativeTvPredictionUrl(`https://creative.tv/predict/${Q}`);
    expect(parsed?.questionId).toBe(Q);
    expect(parseCreativeTvPredictionUrl(`https://crtv.xyz/predict/${Q}`)?.questionId).toBe(
      Q,
    );
  });

  it("rejects invalid question ids and unrelated hosts", () => {
    expect(parseCreativeTvPredictionUrl("https://example.com/predict/0xabc")).toBeNull();
    expect(normalizePredictionQuestionId("0xshort")).toBeNull();
    expect(
      parseCreativeTvPredictionUrl("https://tv.creativeplatform.xyz/watch/demo"),
    ).toBeNull();
  });

  it("finds multiple unique links in text", () => {
    const q2 =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
    const text = `See https://tv.creativeplatform.xyz/predict/${Q} and https://crtv.xyz/predict/${q2}`;
    const links = findCreativeTvPredictionLinks(text);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.questionId).sort()).toEqual([Q, q2].sort());
  });

  it("trusts only Creative TV view URLs for the same question", () => {
    const canonical = `https://tv.creativeplatform.xyz/predict/${Q}`;
    expect(resolveTrustedPredictionViewUrl(Q, canonical)).toBe(canonical);
    expect(resolveTrustedPredictionViewUrl(Q, `https://crtv.xyz/predict/${Q}`)).toBe(
      `https://crtv.xyz/predict/${Q}`,
    );
    // Foreign host: never trusted, falls back to canonical.
    expect(resolveTrustedPredictionViewUrl(Q, `https://evil.example/predict/${Q}`)).toBe(
      canonical,
    );
    // Trusted host but a different question id: not trusted for this question.
    const other =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expect(
      resolveTrustedPredictionViewUrl(Q, `https://tv.creativeplatform.xyz/predict/${other}`),
    ).toBe(canonical);
    // Missing/garbage candidates fall back to canonical.
    expect(resolveTrustedPredictionViewUrl(Q, null)).toBe(canonical);
    expect(resolveTrustedPredictionViewUrl(Q, "not a url")).toBe(canonical);
  });
});
