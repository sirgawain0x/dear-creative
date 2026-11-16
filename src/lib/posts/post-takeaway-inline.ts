/**
 * Helper to split HTML article body into:
 * - introHtml (first 2 paragraphs)
 * - restHtml (remaining paragraphs)
 * This allows clean injection of executive callouts and gated perk blocks.
 */
export function splitArticleAtParagraph(
  bodyHtml: string | null | undefined,
  paragraphIndex = 2,
): { introHtml: string; restHtml: string } {
  if (!bodyHtml || !bodyHtml.trim()) {
    return { introHtml: "", restHtml: "" };
  }

  const voidTags = new Set(["br", "hr", "img", "source"]);
  let depth = 0;
  let count = 0;

  for (const tag of bodyHtml.matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
    const [, closing, name] = tag;
    if (voidTags.has(name)) continue;
    if (!closing) {
      depth++;
      continue;
    }

    depth--;
    if (depth === 0 && name === "p" && ++count === paragraphIndex) {
      const end = tag.index + tag[0].length;
      return {
        introHtml: bodyHtml.slice(0, end),
        restHtml: bodyHtml.slice(end),
      };
    }
  }

  return { introHtml: bodyHtml, restHtml: "" };
}
