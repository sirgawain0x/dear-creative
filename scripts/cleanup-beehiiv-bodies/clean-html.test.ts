import { describe, expect, it } from "vitest";
import { cleanBeehiivPostHtml, stripUtmParamsFromDearcrtvUrl } from "./clean-html";

const slugMap = new Map<string, string>([
  ["creative-fuel-fresh-updates-vegas-vibes", "creative-fuel-fresh-updates-vegas-vibes"],
  ["welcome", "welcome-2023"],
  ["july-24", "july-24"],
]);

describe("cleanBeehiivPostHtml", () => {
  it("strips Powered by beehiiv badge", () => {
    const html =
      '<table><tr><td><a href="https://beehiiv.com"><span>Powered by beehiiv</span></a></td></tr></table><p>Keep</p>';
    const first = cleanBeehiivPostHtml(html, slugMap);
    expect(first.counts.badgeRemoved).toBe(1);
    expect(first.html).not.toMatch(/Powered by beehiiv/i);
    expect(first.html).toContain("Keep");
    const second = cleanBeehiivPostHtml(first.html, slugMap);
    expect(second.counts.badgeRemoved).toBe(0);
    expect(second.changed).toBe(false);
  });

  it("strips subscriber preferences/unsubscribe blocks with {{subscriber_id}}", () => {
    const html = `<p>Update your email preferences or unsubscribe <a href="https://dearcrtv.beehiiv.com/subscribe/{{subscriber_id}}/preferences?post_id=x">here</a></p><p>Body</p>`;
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.subscriberBlocksRemoved).toBeGreaterThan(0);
    expect(result.html).not.toContain("{{subscriber_id}}");
    expect(result.html).toContain("Body");
  });

  it("does not remove the whole email when stripping the beehiiv badge row", () => {
    const html = `<table><tr><td><p>Newsletter body with <a href="https://dearcrtv.beehiiv.com/p/july-24?utm_source=x">link</a></p></td></tr><tr><td><a href="https://beehiiv.com">Powered by beehiiv</a></td></tr></table><p>Update your email preferences or unsubscribe <a href="https://dearcrtv.beehiiv.com/subscribe/{{subscriber_id}}/preferences">here</a></p>`;
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.badgeRemoved).toBe(1);
    expect(result.html).toContain("Newsletter body");
    expect(result.counts.linksRewritten).toBe(1);
    expect(result.counts.subscriberBlocksRemoved).toBe(1);
  });

  it("strips utm_* params from dearcrtv.beehiiv.com links only", () => {
    const html =
      '<a href="https://dearcrtv.beehiiv.com/p/july-24?utm_source=newsletter&utm_campaign=x&post_id=1">link</a>';
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.utmParamsStripped).toBeGreaterThan(0);
    expect(result.html).toContain('href="/posts/july-24"');
    expect(result.html).not.toContain("utm_source");
  });

  it("rewrites mapped dearcrtv /p/ links to /posts/<slug>", () => {
    const html =
      '<a href="https://dearcrtv.beehiiv.com/p/july-24">Read</a>';
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.linksRewritten).toBe(1);
    expect(result.html).toContain('href="/posts/july-24"');
  });

  it("drops unmapped dearcrtv /p/ links but keeps inner text", () => {
    const html =
      '<a href="https://dearcrtv.beehiiv.com/p/unknown-slug">Legacy</a>';
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.linksDropped).toBe(1);
    expect(result.html).toContain("Legacy");
    expect(result.html).not.toContain("unknown-slug");
  });

  it("is idempotent across a full rules pass", () => {
    const html = `
      <table><tr><td>Powered by beehiiv</td></tr></table>
      <p>Unsubscribe <a href="https://dearcrtv.beehiiv.com/subscribe/{{subscriber_id}}/preferences">prefs</a></p>
      <a href="https://dearcrtv.beehiiv.com/p/july-24?utm_source=x">Go</a>
      <a href="https://dearcrtv.beehiiv.com/p/missing">Missing</a>
    `;
    const first = cleanBeehiivPostHtml(html, slugMap);
    const second = cleanBeehiivPostHtml(first.html, slugMap);
    expect(second.changed).toBe(false);
    expect(second.counts).toEqual({
      badgeRemoved: 0,
      subscriberBlocksRemoved: 0,
      utmParamsStripped: 0,
      linksRewritten: 0,
      linksDropped: 0,
    });
  });
});

describe("stripUtmParamsFromDearcrtvUrl", () => {
  it("leaves non-dearcrtv URLs unchanged", () => {
    const result = stripUtmParamsFromDearcrtvUrl(
      "https://example.com?utm_source=1",
    );
    expect(result.stripped).toBe(0);
    expect(result.url).toContain("utm_source");
  });
});
