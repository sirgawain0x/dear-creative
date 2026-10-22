const BEEHIIV_IMAGE_HOSTS = new Set([
  "media.beehiiv.com",
  "beehiiv-images-production.s3.amazonaws.com",
]);

export function isBeehiivHostedImageUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (BEEHIIV_IMAGE_HOSTS.has(url.hostname)) {
      return true;
    }
    return url.hostname.endsWith(".beehiiv.com") && url.pathname.includes("/cdn/");
  } catch {
    return false;
  }
}

const SRC_ATTR_RE =
  /(\s(?:src|href)=)(?:"([^"]+)"|'([^']+)'|(https?:\/\/[^\s>]+))/gi;

function urlFromAttrMatch(match: RegExpExecArray): string | null {
  return match[2] ?? match[3] ?? match[4] ?? null;
}

export function extractBeehiivImageUrls(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(SRC_ATTR_RE)) {
    const url = urlFromAttrMatch(match);
    if (url && isBeehiivHostedImageUrl(url)) {
      found.add(url);
    }
  }
  return [...found];
}

export function stripImageTagsContainingUrls(
  html: string,
  urls: readonly string[],
): string {
  let result = html;
  for (const url of urls) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`<img[^>]*${escaped}[^>]*>`, "gi"), "");
  }
  return result;
}

export function rewriteHtmlImageUrls(
  html: string,
  mapping: ReadonlyMap<string, string>,
): string {
  return html.replace(SRC_ATTR_RE, (full, prefix, ...rest) => {
    const quotedDouble = rest[0] as string | undefined;
    const quotedSingle = rest[1] as string | undefined;
    const unquoted = rest[2] as string | undefined;
    const url = quotedDouble ?? quotedSingle ?? unquoted;
    if (!url) {
      return full;
    }
    const replacement = mapping.get(url);
    if (!replacement) {
      return full;
    }
    if (quotedDouble !== undefined) {
      return `${prefix}"${replacement}"`;
    }
    if (quotedSingle !== undefined) {
      return `${prefix}'${replacement}'`;
    }
    return `${prefix}${replacement}`;
  });
}
