const DEARCRTV_HOST = "dearcrtv.beehiiv.com";
const BEEHIIV_POST_PATH = /\/p\/([^/?#]+)/i;
const NEWS_SITE_ORIGIN = "https://news.creativeplatform.xyz";
const CLEANUP_VOID_MARKER = "<!--beehiiv-cleanup-void-->";
const OMNivery_HONEYPOT_TOKEN = "{{omnivery_honeypot_hash}}";
const OMNivery_HONEYPOT_ENCODED = encodeURIComponent(OMNivery_HONEYPOT_TOKEN).toLowerCase();

export type CleanupCounts = {
  badgeRemoved: number;
  subscriberBlocksRemoved: number;
  utmParamsStripped: number;
  utmParamsStrippedFromBeehiivSource: number;
  beehiivSubscriberLinksRemoved: number;
  shareUrlsRewritten: number;
  omniveryHoneypotLinksRemoved: number;
  authorLinksUnwrapped: number;
  danielbaarnsUtmParamsStripped: number;
  linksRewritten: number;
  linksDropped: number;
};

export type CleanupResult = {
  html: string;
  counts: CleanupCounts;
  changed: boolean;
};

function emptyCounts(): CleanupCounts {
  return {
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
  };
}

const SUBSCRIBER_ID_TOKEN = "{{subscriber_id}}";
const SUBSCRIBER_ID_ENCODED = encodeURIComponent(SUBSCRIBER_ID_TOKEN).toLowerCase();

const BEEHIIV_NAV_LINK_LABELS = new Set([
  "view online",
  "view in browser",
  "read online",
  "manage preferences",
  "email preferences",
  "update preferences",
  "subscriber preferences",
  "unsubscribe",
  "preferences",
]);

function isBeehiivHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "beehiiv.com" || host.endsWith(".beehiiv.com");
}

function hrefContainsSubscriberId(href: string): boolean {
  if (href.includes(SUBSCRIBER_ID_TOKEN)) {
    return true;
  }
  try {
    return decodeURIComponent(href).includes(SUBSCRIBER_ID_TOKEN);
  } catch {
    return href.toLowerCase().includes(SUBSCRIBER_ID_ENCODED);
  }
}

function visibleAnchorText(innerHtml: string): string {
  return innerHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBeehiivNavLinkLabel(innerHtml: string): boolean {
  const text = visibleAnchorText(innerHtml).toLowerCase();
  if (text.length === 0) {
    return true;
  }
  return BEEHIIV_NAV_LINK_LABELS.has(text);
}

function utmSourceValuesContainBeehiiv(parsed: URL): boolean {
  for (const [key, value] of parsed.searchParams.entries()) {
    if (key.toLowerCase() === "utm_source" && value.toLowerCase().includes("beehiiv")) {
      return true;
    }
  }
  return false;
}

export function stripUtmParamsWhenSourceContainsBeehiiv(rawUrl: string): {
  url: string;
  stripped: number;
} {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { url: rawUrl, stripped: 0 };
  }
  if (!utmSourceValuesContainBeehiiv(parsed)) {
    return { url: rawUrl, stripped: 0 };
  }

  let stripped = 0;
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_")) {
      parsed.searchParams.delete(key);
      stripped += 1;
    }
  }
  return { url: parsed.toString(), stripped };
}

function isDearcrtvBeehiivUrl(url: URL): boolean {
  return url.hostname.toLowerCase() === DEARCRTV_HOST;
}

export function stripUtmParamsFromDearcrtvUrl(rawUrl: string): {
  url: string;
  stripped: number;
} {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { url: rawUrl, stripped: 0 };
  }
  if (!isDearcrtvBeehiivUrl(parsed)) {
    return { url: rawUrl, stripped: 0 };
  }

  let stripped = 0;
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_")) {
      parsed.searchParams.delete(key);
      stripped += 1;
    }
  }
  const serialized = parsed.toString();
  return { url: serialized, stripped };
}

function removePoweredByBeehiivBadge(html: string): { html: string; removed: number } {
  let removed = 0;
  let result = html;

  // Stay within a single <tr> or <a> — do not span nested rows/links.
  const patterns = [
    /<tr[^>]*>(?:(?!<\/tr>)[\s\S])*Powered by beehiiv(?:(?!<\/tr>)[\s\S])*<\/tr>/gi,
    /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*Powered by beehiiv(?:(?!<\/a>)[\s\S])*<\/a>/gi,
  ];

  for (const pattern of patterns) {
    const next = result.replace(pattern, () => {
      removed += 1;
      return "";
    });
    result = next;
  }

  return { html: result, removed: removed > 0 ? 1 : 0 };
}

function removeSubscriberIdBlocks(html: string): { html: string; removed: number } {
  let removed = 0;
  let result = html;

  const blockPatterns = [
    /<p[^>]*>(?:(?!<\/p>)[\s\S])*?\{\{subscriber_id\}\}(?:(?!<\/p>)[\s\S])*?(?:unsubscribe|preferences)(?:(?!<\/p>)[\s\S])*?<\/p>/gi,
    /<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:unsubscribe|preferences)(?:(?!<\/p>)[\s\S])*?\{\{subscriber_id\}\}(?:(?!<\/p>)[\s\S])*?<\/p>/gi,
    /<td[^>]*>(?:(?!<\/td>)[\s\S])*?\{\{subscriber_id\}\}(?:(?!<\/td>)[\s\S])*?(?:unsubscribe|preferences)(?:(?!<\/td>)[\s\S])*?<\/td>/gi,
    /<td[^>]*>(?:(?!<\/td>)[\s\S])*?(?:unsubscribe|preferences)(?:(?!<\/td>)[\s\S])*?\{\{subscriber_id\}\}(?:(?!<\/td>)[\s\S])*?<\/td>/gi,
  ];

  for (const pattern of blockPatterns) {
    result = result.replace(pattern, () => {
      removed += 1;
      return "";
    });
  }

  const anchorPattern =
    /<a\b[^>]*href=["'][^"']*\{\{subscriber_id\}\}[^"']*(?:preferences|unsubscribe|\/subscribe\/)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
  result = result.replace(anchorPattern, () => {
    removed += 1;
    return "";
  });

  return { html: result, removed };
}

function rewriteDearcrtvPostLinks(
  html: string,
  slugMap: ReadonlyMap<string, string>,
): { html: string; rewritten: number; dropped: number } {
  let rewritten = 0;
  let dropped = 0;

  const result = html.replace(
    /<a\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, before, quote, href, after, inner) => {
      let parsed: URL;
      try {
        parsed = new URL(href);
      } catch {
        return full;
      }
      if (!isDearcrtvBeehiivUrl(parsed)) {
        return full;
      }
      const match = BEEHIIV_POST_PATH.exec(parsed.pathname);
      if (!match?.[1]) {
        return full;
      }
      const beehiivSlug = decodeURIComponent(match[1]);
      const ourSlug = slugMap.get(beehiivSlug);
      if (ourSlug) {
        rewritten += 1;
        return `<a${before}href=${quote}/posts/${ourSlug}${quote}${after}>${inner}</a>`;
      }
      dropped += 1;
      return inner;
    },
  );

  return { html: result, rewritten, dropped };
}

function stripUtmInHtml(html: string): { html: string; stripped: number } {
  let stripped = 0;
  const result = html.replace(
    /(\b(?:href|src)=)(["'])(https?:\/\/dearcrtv\.beehiiv\.com[^"']+)\2/gi,
    (full, prefix, quote, url) => {
      const cleaned = stripUtmParamsFromDearcrtvUrl(url);
      stripped += cleaned.stripped;
      return `${prefix}${quote}${cleaned.url}${quote}`;
    },
  );
  return { html: result, stripped };
}

function stripUtmBeehiivSourceInHtml(html: string): { html: string; stripped: number } {
  let stripped = 0;
  const result = html.replace(
    /(\b(?:href|src)=)(["'])(https?:\/\/[^"']+)\2/gi,
    (full, prefix, quote, url) => {
      const cleaned = stripUtmParamsWhenSourceContainsBeehiiv(url);
      stripped += cleaned.stripped;
      if (cleaned.stripped === 0) {
        return full;
      }
      return `${prefix}${quote}${cleaned.url}${quote}`;
    },
  );
  return { html: result, stripped };
}

function isDanielbaarnsSubscribeUrl(hostname: string, pathname: string): boolean {
  return (
    hostname.toLowerCase() === "danielbaarns.beehiiv.com" &&
    pathname.toLowerCase().includes("/subscribe")
  );
}

function buildNewsPostUrl(beehiivSlug: string, slugMap: ReadonlyMap<string, string>): string | null {
  const decoded = decodeURIComponent(beehiivSlug);
  const ourSlug = slugMap.get(decoded) ?? slugMap.get(beehiivSlug);
  if (!ourSlug) {
    return null;
  }
  return `${NEWS_SITE_ORIGIN}/posts/${ourSlug}`;
}

function mapDearcrtvPostTargetToNews(rawTarget: string, slugMap: ReadonlyMap<string, string>): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawTarget);
  } catch {
    return null;
  }
  if (!isDearcrtvBeehiivUrl(parsed)) {
    return null;
  }
  const match = BEEHIIV_POST_PATH.exec(parsed.pathname);
  if (!match?.[1]) {
    return null;
  }
  return buildNewsPostUrl(match[1], slugMap);
}

function isSocialShareHref(href: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (host.includes("facebook.com") && parsed.pathname.includes("/sharer")) {
    return true;
  }
  if ((host === "twitter.com" || host === "x.com") && parsed.pathname.includes("/intent/tweet")) {
    return true;
  }
  if (host.includes("threads.net") && parsed.pathname.includes("/intent/post")) {
    return true;
  }
  if (host.includes("linkedin.com") && parsed.pathname.includes("/share")) {
    return true;
  }
  return false;
}

export function rewriteSocialShareHref(
  href: string,
  slugMap: ReadonlyMap<string, string>,
): { href: string; rewritten: number } {
  if (!isSocialShareHref(href)) {
    return { href, rewritten: 0 };
  }
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return { href, rewritten: 0 };
  }

  const host = parsed.hostname.toLowerCase();
  if (host.includes("threads.net")) {
    const text = parsed.searchParams.get("text");
    if (!text) {
      return { href, rewritten: 0 };
    }
    const { text: nextText, count } = replaceDearcrtvPostUrlsInShareText(text, slugMap);
    if (count === 0) {
      return { href, rewritten: 0 };
    }
    parsed.searchParams.set("text", nextText);
    return { href: parsed.toString(), rewritten: count };
  }

  const paramName = host.includes("facebook.com") ? "u" : "url";
  const target = parsed.searchParams.get(paramName);
  if (!target) {
    return { href, rewritten: 0 };
  }
  const newsUrl = mapDearcrtvPostTargetToNews(target, slugMap);
  if (!newsUrl) {
    return { href, rewritten: 0 };
  }
  parsed.searchParams.set(paramName, newsUrl);
  return { href: parsed.toString(), rewritten: 1 };
}

function replaceDearcrtvPostUrlsInShareText(
  text: string,
  slugMap: ReadonlyMap<string, string>,
): { text: string; count: number } {
  let count = 0;
  let result = text;

  result = result.replace(
    /https:\/\/dearcrtv\.beehiiv\.com\/p\/([^/?#\s&+]+)/gi,
    (full, slug: string) => {
      const news = buildNewsPostUrl(slug, slugMap);
      if (!news) {
        return full;
      }
      count += 1;
      return news;
    },
  );

  result = result.replace(
    /https%3A%2F%2Fdearcrtv\.beehiiv\.com%2Fp%2F([^/?#\s&+%]+)/gi,
    (full, slug: string) => {
      const news = buildNewsPostUrl(decodeURIComponent(slug.replace(/\+/g, "%20")), slugMap);
      if (!news) {
        return full;
      }
      count += 1;
      return encodeURIComponent(news);
    },
  );

  return { text: result, count };
}

function rewriteShareButtonUrlsInHtml(
  html: string,
  slugMap: ReadonlyMap<string, string>,
): { html: string; rewritten: number } {
  let rewritten = 0;
  const result = html.replace(
    /(\bhref=)(["'])([^"']+)\2/gi,
    (full, prefix, quote, href) => {
      const next = rewriteSocialShareHref(href, slugMap);
      rewritten += next.rewritten;
      if (next.rewritten === 0) {
        return full;
      }
      return `${prefix}${quote}${next.href}${quote}`;
    },
  );
  return { html: result, rewritten };
}

function hrefContainsOmniveryHoneypot(href: string): boolean {
  if (href.includes(OMNivery_HONEYPOT_TOKEN)) {
    return true;
  }
  try {
    return decodeURIComponent(href).includes(OMNivery_HONEYPOT_TOKEN);
  } catch {
    return href.toLowerCase().includes(OMNivery_HONEYPOT_ENCODED);
  }
}

function removeOmniveryHoneypotLinks(html: string): { html: string; removed: number } {
  let removed = 0;
  const result = html.replace(
    /<a\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, before, quote, href, after, inner) => {
      let parsed: URL;
      try {
        parsed = new URL(href);
      } catch {
        return full;
      }
      if (
        parsed.hostname.toLowerCase() !== "email.beehiivstatus.com" ||
        !hrefContainsOmniveryHoneypot(href)
      ) {
        return full;
      }
      removed += 1;
      if (visibleAnchorText(inner).length === 0) {
        return CLEANUP_VOID_MARKER;
      }
      return inner;
    },
  );
  return { html: result, removed };
}

function unwrapDearcrtvAuthorLinks(html: string): { html: string; unwrapped: number } {
  let unwrapped = 0;
  const result = html.replace(
    /<a\b([^>]*?)href=(["'])(https?:\/\/dearcrtv\.beehiiv\.com\/authors\/[^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, before, quote, href, after, inner) => {
      unwrapped += 1;
      return inner;
    },
  );
  return { html: result, unwrapped };
}

export function stripAllUtmParams(rawUrl: string): { url: string; stripped: number } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { url: rawUrl, stripped: 0 };
  }
  let stripped = 0;
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_")) {
      parsed.searchParams.delete(key);
      stripped += 1;
    }
  }
  return { url: parsed.toString(), stripped };
}

function stripDanielbaarnsSubscribeUtmInHtml(html: string): { html: string; stripped: number } {
  let stripped = 0;
  const result = html.replace(
    /(\bhref=)(["'])(https?:\/\/danielbaarns\.beehiiv\.com\/subscribe[^"']*)\2/gi,
    (full, prefix, quote, url) => {
      const cleaned = stripAllUtmParams(url);
      stripped += cleaned.stripped;
      if (cleaned.stripped === 0) {
        return full;
      }
      return `${prefix}${quote}${cleaned.url}${quote}`;
    },
  );
  return { html: result, stripped };
}

function removeBeehiivSubscriberIdLinks(html: string): { html: string; removed: number } {
  let removed = 0;
  let result = html.replace(
    /<a\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, before, quote, href, after, inner) => {
      let parsed: URL;
      try {
        parsed = new URL(href);
      } catch {
        return full;
      }
      if (isDanielbaarnsSubscribeUrl(parsed.hostname, parsed.pathname)) {
        return full;
      }
      if (!isBeehiivHost(parsed.hostname) || !hrefContainsSubscriberId(href)) {
        return full;
      }
      removed += 1;
      if (isBeehiivNavLinkLabel(inner)) {
        return CLEANUP_VOID_MARKER;
      }
      return inner;
    },
  );

  result = removeWrappersAroundVoidMarker(result);
  return { html: result, removed };
}

function removeWrappersAroundVoidMarker(html: string): string {
  let result = html;
  const marker = CLEANUP_VOID_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wrapped = new RegExp(
    `<(?:p|td|div|span)(\\s[^>]*)?>\\s*(?:&nbsp;|\\u00a0|\\s)*${marker}(?:\\s*(?:&nbsp;|\\u00a0|\\s)*)?<\\/(?:p|td|div|span)>`,
    "gi",
  );
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(wrapped, "");
  }
  return result.replaceAll(CLEANUP_VOID_MARKER, "");
}

export type CleanBeehiivPostHtmlOptions = {
  /** Skip pass-2 rules (prod already ran the initial cleanup). */
  skipExtendedRules?: boolean;
  /** Skip pass-3 rules (prod already ran pass 1 and 2). */
  skipPass3Rules?: boolean;
};

export function cleanBeehiivPostHtml(
  html: string,
  slugMap: ReadonlyMap<string, string>,
  options?: CleanBeehiivPostHtmlOptions,
): CleanupResult {
  const counts = emptyCounts();
  let result = html;

  const badge = removePoweredByBeehiivBadge(result);
  result = badge.html;
  counts.badgeRemoved = badge.removed;

  const subscriberBlocks = removeSubscriberIdBlocks(result);
  result = subscriberBlocks.html;
  counts.subscriberBlocksRemoved = subscriberBlocks.removed;

  const utm = stripUtmInHtml(result);
  result = utm.html;
  counts.utmParamsStripped = utm.stripped;

  if (!options?.skipExtendedRules) {
    const beehiivSubscriberLinks = removeBeehiivSubscriberIdLinks(result);
    result = beehiivSubscriberLinks.html;
    counts.beehiivSubscriberLinksRemoved = beehiivSubscriberLinks.removed;

    const utmBeehiivSource = stripUtmBeehiivSourceInHtml(result);
    result = utmBeehiivSource.html;
    counts.utmParamsStrippedFromBeehiivSource = utmBeehiivSource.stripped;
  }

  const links = rewriteDearcrtvPostLinks(result, slugMap);
  result = links.html;
  counts.linksRewritten = links.rewritten;
  counts.linksDropped = links.dropped;

  if (!options?.skipPass3Rules) {
    const share = rewriteShareButtonUrlsInHtml(result, slugMap);
    result = share.html;
    counts.shareUrlsRewritten = share.rewritten;

    const honeypot = removeOmniveryHoneypotLinks(result);
    result = honeypot.html;
    counts.omniveryHoneypotLinksRemoved = honeypot.removed;
    result = removeWrappersAroundVoidMarker(result);

    const authors = unwrapDearcrtvAuthorLinks(result);
    result = authors.html;
    counts.authorLinksUnwrapped = authors.unwrapped;

    const danielbaarns = stripDanielbaarnsSubscribeUtmInHtml(result);
    result = danielbaarns.html;
    counts.danielbaarnsUtmParamsStripped = danielbaarns.stripped;
  }

  return {
    html: result,
    counts,
    changed: result !== html,
  };
}
