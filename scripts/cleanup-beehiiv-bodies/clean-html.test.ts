import { describe, expect, it } from "vitest";
import {
  cleanBeehiivPostHtml,
  rewriteSocialShareHref,
  stripUtmParamsFromDearcrtvUrl,
  stripUtmParamsWhenSourceContainsBeehiiv,
} from "./clean-html";

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
      utmParamsStrippedFromBeehiivSource: 0,
      beehiivSubscriberLinksRemoved: 0,
      shareUrlsRewritten: 0,
      omniveryHoneypotLinksRemoved: 0,
      authorLinksUnwrapped: 0,
      danielbaarnsUtmParamsStripped: 0,
      linksRewritten: 0,
      linksDropped: 0,
    });
  });

  it("strips utm_* on any host when utm_source contains beehiiv", () => {
    const html =
      '<a href="https://coinbase.com/?utm_source=dearcrtv.beehiiv.com&utm_medium=newsletter&utm_campaign=x">Buy</a>';
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.utmParamsStrippedFromBeehiivSource).toBe(3);
    expect(result.html).toContain("https://coinbase.com/");
    expect(result.html).not.toContain("utm_");
    const again = cleanBeehiivPostHtml(result.html, slugMap);
    expect(again.counts.utmParamsStrippedFromBeehiivSource).toBe(0);
    expect(again.changed).toBe(false);
  });

  it("removes *.beehiiv.com links with subscriber_id in href and drops nav labels", () => {
    const html =
      "<p><a href=\"https://hp.beehiiv.com/{{subscriber_id}}\" style=\"font-size:1px\"></a></p><a href=\"https://hp.beehiiv.com/%7B%7Bsubscriber_id%7D%7D\">View Online</a>";
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.beehiivSubscriberLinksRemoved).toBe(2);
    expect(result.html).not.toContain("hp.beehiiv.com");
    expect(result.html).not.toMatch(/View Online/i);
  });

  it("unwraps beehiiv subscriber_id links when anchor text is real content", () => {
    const html =
      '<p>Intro <a href="https://hp.beehiiv.com/{{subscriber_id}}">Read the full story</a> end</p>';
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.beehiivSubscriberLinksRemoved).toBe(1);
    expect(result.html).toContain("Read the full story");
    expect(result.html).not.toContain("hp.beehiiv.com");
  });

  it("is idempotent on bodies already cleaned by the first pass", () => {
    const raw = `
      <table><tr><td><a href="https://beehiiv.com">Powered by beehiiv</a></td></tr></table>
      <p>Update your email preferences or unsubscribe <a href="https://dearcrtv.beehiiv.com/subscribe/{{subscriber_id}}/preferences">here</a></p>
      <a href="https://dearcrtv.beehiiv.com/p/july-24?utm_source=dearcrtv.beehiiv.com&utm_medium=x">Go</a>
      <a href="https://creativeplatform.xyz?utm_source=dearcrtv.beehiiv.com&utm_medium=newsletter">Site</a>
      <a href="https://hp.beehiiv.com/{{subscriber_id}}"></a>
    `;
    const firstPass = cleanBeehiivPostHtml(raw, slugMap, {
      skipExtendedRules: true,
    });
    const secondPass = cleanBeehiivPostHtml(firstPass.html, slugMap);
    expect(secondPass.changed).toBe(true);
    expect(secondPass.counts.utmParamsStrippedFromBeehiivSource).toBeGreaterThan(0);
    expect(secondPass.counts.beehiivSubscriberLinksRemoved).toBe(1);
    const thirdPass = cleanBeehiivPostHtml(secondPass.html, slugMap);
    expect(thirdPass.changed).toBe(false);
    expect(thirdPass.counts.utmParamsStrippedFromBeehiivSource).toBe(0);
    expect(thirdPass.counts.beehiivSubscriberLinksRemoved).toBe(0);
  });

  it("rewrites social share URLs to news.creativeplatform.xyz posts", () => {
    const html =
      '<a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdearcrtv.beehiiv.com%2Fp%2Fjuly-24">fb</a>';
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.shareUrlsRewritten).toBe(1);
    expect(result.html).toContain(
      encodeURIComponent("https://news.creativeplatform.xyz/posts/july-24"),
    );
    expect(result.html).not.toContain("dearcrtv.beehiiv.com");
  });

  it("removes email.beehiivstatus.com omnivery honeypot links", () => {
    const html =
      "<p><a href=\"https://email.beehiivstatus.com/{{omnivery_honeypot_hash}}/hclick\"></a></p><p>Body</p><p></p>";
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.omniveryHoneypotLinksRemoved).toBe(1);
    expect(result.html).not.toContain("beehiivstatus.com");
    expect(result.html).toContain("Body");
    expect(result.html).toMatch(/<p>\s*<\/p>/);
  });

  it("unwraps dearcrtv author profile links", () => {
    const html =
      '<p>By <a href="https://dearcrtv.beehiiv.com/authors/creative">Creative DAO</a></p>';
    const result = cleanBeehiivPostHtml(html, slugMap);
    expect(result.counts.authorLinksUnwrapped).toBe(1);
    expect(result.html).toContain("Creative DAO");
    expect(result.html).not.toContain("/authors/");
  });

  it("keeps danielbaarns subscribe promo links but strips utm params", () => {
    const html =
      '<a href="https://danielbaarns.beehiiv.com/subscribe?utm_medium=newsletter&utm_campaign=promo">Promo</a>';
    const pass12 = cleanBeehiivPostHtml(html, slugMap, { skipPass3Rules: true });
    const pass3 = cleanBeehiivPostHtml(pass12.html, slugMap);
    expect(pass3.html).toContain("danielbaarns.beehiiv.com/subscribe");
    expect(pass3.html).toContain("Promo");
    expect(pass3.counts.danielbaarnsUtmParamsStripped).toBe(2);
    expect(pass3.html).not.toContain("utm_");
  });

  it("is idempotent on pass-2 output for pass-3 rules", () => {
    const raw = `<a href="https://www.linkedin.com/sharing/share-offsite?url=https%3A%2F%2Fdearcrtv.beehiiv.com%2Fp%2Fjuly-24">in</a>
      <a href="https://email.beehiivstatus.com/{{omnivery_honeypot_hash}}/hclick"></a>
      <a href="https://dearcrtv.beehiiv.com/authors/x">Author</a>`;
    const pass12 = cleanBeehiivPostHtml(raw, slugMap, { skipPass3Rules: true });
    const pass3 = cleanBeehiivPostHtml(pass12.html, slugMap);
    expect(pass3.counts.shareUrlsRewritten).toBe(1);
    expect(pass3.counts.omniveryHoneypotLinksRemoved).toBe(1);
    expect(pass3.counts.authorLinksUnwrapped).toBe(1);
    const again = cleanBeehiivPostHtml(pass3.html, slugMap);
    expect(again.changed).toBe(false);
    expect(again.counts.shareUrlsRewritten).toBe(0);
    expect(again.counts.omniveryHoneypotLinksRemoved).toBe(0);
    expect(again.counts.authorLinksUnwrapped).toBe(0);
  });
});

describe("rewriteSocialShareHref", () => {
  it("encodes Twitter url param to news site", () => {
    const result = rewriteSocialShareHref(
      "https://twitter.com/intent/tweet?url=https%3A%2F%2Fdearcrtv.beehiiv.com%2Fp%2Fjuly-24&text=Hi",
      slugMap,
    );
    expect(result.rewritten).toBe(1);
    expect(result.href).toContain("news.creativeplatform.xyz");
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

describe("stripUtmParamsWhenSourceContainsBeehiiv", () => {
  it("strips utm_* when utm_source mentions beehiiv on any host", () => {
    const result = stripUtmParamsWhenSourceContainsBeehiiv(
      "https://example.com/path?utm_source=dearcrtv.beehiiv.com&utm_medium=email",
    );
    expect(result.stripped).toBe(2);
    expect(result.url).toBe("https://example.com/path");
  });

  it("does not strip when utm_source has no beehiiv", () => {
    const result = stripUtmParamsWhenSourceContainsBeehiiv(
      "https://example.com?utm_source=newsletter&utm_medium=email",
    );
    expect(result.stripped).toBe(0);
  });
});
