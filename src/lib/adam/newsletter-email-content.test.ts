import { afterEach, describe, expect, it, vi } from "vitest";
import { setPaywallEnabledForTests } from "@/lib/paywall/feature-flag";
import { buildNewsletterEmailContent } from "./newsletter-email-content";

describe("buildNewsletterEmailContent", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  const base = {
    slug: "gated-issue",
    canonicalUrl: null as string | null,
    isGated: true,
    freeContent: "<p>Free section only</p>",
    gatedContent: "<p>Secret paid section</p>",
    emailHtml:
      "<p>Free section only</p><p>Secret paid section</p><p>More full email</p>",
  };

  it("returns full emailHtml when paywall flag is off", () => {
    setPaywallEnabledForTests(false);
    const result = buildNewsletterEmailContent(base);
    expect(result).toEqual({ html: base.emailHtml });
  });

  it("returns full emailHtml for ungated posts when paywall is on", () => {
    setPaywallEnabledForTests(true);
    const result = buildNewsletterEmailContent({
      ...base,
      isGated: false,
    });
    expect(result).toEqual({ html: base.emailHtml });
  });

  it("excludes gated content from html, text, and preview when paywall is on", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dear.example.test");
    setPaywallEnabledForTests(true);

    const result = buildNewsletterEmailContent(base);

    expect(result.html).toContain("Free section only");
    expect(result.html).not.toContain("Secret paid section");
    expect(result.html).not.toContain("More full email");
    expect(result.html).toContain('href="https://dear.example.test/posts/gated-issue"');
    expect(result.html).toContain("Read the rest");

    expect(result.text).toContain("Free section only");
    expect(result.text).not.toContain("Secret paid section");
    expect(result.text).toContain(
      "Read the rest: https://dear.example.test/posts/gated-issue",
    );

    expect(result.html).toContain('aria-hidden="true"');
    expect(result.html).toContain("display:none");
    expect(result.html).toContain("Free section only");
    expect(result.html).not.toContain("Secret paid section");
    expect(result.text).not.toContain("Secret paid section");
  });
});
