import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "./html-to-markdown";
import { ensureArticleHtml } from "./markdown-to-html";

describe("htmlToMarkdown & roundtrip formatting", () => {
  it("converts imported HTML headings, paragraphs, bold, links, lists, and strips postPreview artifacts", () => {
    const importedHtml = [
      "<p>Dear Creative,</p>",
      '<p><a href="https://www.wmg.com/" rel="noopener noreferrer nofollow">Warner Music Group</a> just bought the receipts.</p>',
      "<h3>The Provenance Power Play</h3>",
      '<img src="https://storage.googleapis.com/papyrus_images/sample.png" alt="Diagram" loading="lazy" />',
      "<p>Warner Music Group is acquiring Sureel AI for <strong>AI IP protection</strong> and <em>voice verification</em>.</p>",
      "<ul><li>First point</li><li>Second point</li></ul>",
      "<p><em>Sources: Record of the Day</em>\",postPreview:</p>",
    ].join("");

    const md = htmlToMarkdown(importedHtml);
    expect(md).toContain("Dear Creative,");
    expect(md).toContain("[Warner Music Group](https://www.wmg.com/)");
    expect(md).toContain("### The Provenance Power Play");
    expect(md).toContain(
      "![Diagram](https://storage.googleapis.com/papyrus_images/sample.png)",
    );
    expect(md).toContain("**AI IP protection**");
    expect(md).toContain("*voice verification*");
    expect(md).toContain("- First point\n- Second point");
    expect(md).not.toContain("postPreview:");

    const renderedBack = ensureArticleHtml(md);
    expect(renderedBack).toContain("<h3>The Provenance Power Play</h3>");
    expect(renderedBack).toContain("<strong>AI IP protection</strong>");
    expect(renderedBack).not.toContain("postPreview:");
  });

  it("promotes Markdown headings accidentally wrapped in <p> tags", () => {
    const html = "<p>## Restored Section Header</p><p>Body paragraph.</p>";
    const normalized = ensureArticleHtml(html);
    expect(normalized).toContain("<h2>Restored Section Header</h2>");
    expect(normalized).toContain("<p>Body paragraph.</p>");
  });

  it("keeps saved videos and X cards playable after switching to Markdown", () => {
    const url = "https://x.com/EvidentlyDenzel/status/2115606402139889766";
    const asset = "https://tv.creativeplatform.xyz/discover/c1a0f016-06df-4c04-bc9e-4f697d5b9b4b";
    const video = "https://api.grove.storage/video?ext=mp4";
    const stored = [
      `<blockquote><p>𝕏@EvidentlyDenzel <a href="${url}?s=20">View post on 𝕏 (@EvidentlyDenzel) ↗</a></p></blockquote>`,
      "<p>Studio footage</p>",
      `<p><video controls><br /><source src="${video}" type="video/mp4"><br /></video></p>`,
      `<p>&lt;iframe src="${asset}"&gt;&lt;/iframe&gt;</p>`,
    ].join("");

    const markdown = htmlToMarkdown(stored);
    expect(markdown.startsWith(`${url}\n\n`)).toBe(true);
    const html = ensureArticleHtml(markdown);
    expect(html).toContain('class="twitter-tweet dear-x-card"');
    expect(html).toContain(`src="${video}"`);
    expect(html).toContain(`src="${asset}"`);
    expect(html).not.toContain("<p><video");
  });

  it("converts a generated MP4 player back into the editor's video syntax", () => {
    const url = "https://gateway.pinata.cloud/ipfs/example?ext=mp4";
    const markdown = "[video](" + url + ")";
    expect(htmlToMarkdown(ensureArticleHtml(markdown))).toBe(markdown);
  });
});
