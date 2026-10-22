const DEARCRTV_HOST = "dearcrtv.beehiiv.com";
const BEEHIIV_POST_PATH = /\/p\/([^/?#]+)/i;

export type CleanupCounts = {
  badgeRemoved: number;
  subscriberBlocksRemoved: number;
  utmParamsStripped: number;
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
    linksRewritten: 0,
    linksDropped: 0,
  };
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

export function cleanBeehiivPostHtml(
  html: string,
  slugMap: ReadonlyMap<string, string>,
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

  const links = rewriteDearcrtvPostLinks(result, slugMap);
  result = links.html;
  counts.linksRewritten = links.rewritten;
  counts.linksDropped = links.dropped;

  return {
    html: result,
    counts,
    changed: result !== html,
  };
}
