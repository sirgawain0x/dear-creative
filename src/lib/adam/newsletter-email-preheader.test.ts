import { describe, expect, it } from "vitest";
import {
  buildHiddenEmailPreheader,
  prependHiddenEmailPreheader,
} from "./newsletter-email-preheader";

describe("newsletter email preheader", () => {
  it("renders a hidden preheader block with escaped text", () => {
    const block = buildHiddenEmailPreheader('Free & "safe" preview');
    expect(block).toContain('display:none');
    expect(block).toContain('max-height:0');
    expect(block).toContain('aria-hidden="true"');
    expect(block).toContain("Free &amp; &quot;safe&quot; preview");
  });

  it("prepends preheader before body html", () => {
    const html = prependHiddenEmailPreheader(
      "<p>Body</p>",
      "Inbox preview line",
    );
    expect(html.startsWith('<div style="display:none')).toBe(true);
    expect(html).toContain("<p>Body</p>");
  });
});
