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

  it("does not corrupt an existing embed placeholder's data-view-url", () => {
    const placeholder = `<div class="dear-prediction-embed" data-question-id="${Q}" data-view-url="https://tv.creativeplatform.xyz/predict/${Q}"></div>`;
    const html = `<p>Before</p>${placeholder}<p>After</p>`;
    const { html: next, slots } = transformPredictionLinksInArticleHtml(html);
    expect(next).toBe(html);
    expect(next).not.toContain("data-view-url=\"<div");
    expect(slots).toHaveLength(0);
  });

  it("does not replace prediction URLs inside tag attributes", () => {
    const html = `<p data-ref="https://tv.creativeplatform.xyz/predict/${Q}">text</p>`;
    const { html: next, slots } = transformPredictionLinksInArticleHtml(html);
    expect(next).toBe(html);
    expect(slots).toHaveLength(0);
  });

  it("replaces a bare prediction URL in text", () => {
    const html = `<p>See https://tv.creativeplatform.xyz/predict/${Q} for details</p>`;
    const { html: next, slots } = transformPredictionLinksInArticleHtml(html);
    expect(slots).toHaveLength(1);
    expect(next).toContain("dear-prediction-embed");
    expect(next).toContain("for details");
  });

  it("leaves unrelated links unchanged", () => {
    const html = `<p><a href="https://example.com">Other</a></p>`;
    const { html: next, slots } = transformPredictionLinksInArticleHtml(html);
    expect(slots).toHaveLength(0);
    expect(next).toBe(html);
  });
});
