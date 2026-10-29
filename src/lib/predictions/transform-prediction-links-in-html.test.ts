import { describe, expect, it } from "vitest";
import { transformPredictionLinksInArticleHtml } from "./transform-prediction-links-in-html";

const Q =
  "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

describe("transform-prediction-links-in-html", () => {
  it("replaces anchor predict links with embed placeholders", () => {
    const html = `<p>Check <a href="https://tv.creativeplatform.xyz/predict/${Q}">market</a> now.</p>`;
    const { html: next, slots } = transformPredictionLinksInArticleHtml(html);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.questionId).toBe(Q);
    expect(next).toContain("dear-prediction-embed");
    expect(next).not.toContain("<a href");
  });

  it("leaves unrelated links unchanged", () => {
    const html = `<p><a href="https://example.com">Other</a></p>`;
    const { html: next, slots } = transformPredictionLinksInArticleHtml(html);
    expect(slots).toHaveLength(0);
    expect(next).toBe(html);
  });
});
