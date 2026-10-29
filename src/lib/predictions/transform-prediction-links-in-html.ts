import {
  findCreativeTvPredictionLinks,
  parseCreativeTvPredictionUrl,
} from "@/lib/predictions/creative-tv-prediction-link";

export type PredictionEmbedSlot = {
  questionId: `0x${string}`;
  viewUrl: string;
};

const ANCHOR_PREDICT_REGEX =
  /<a\s+[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;

function slotMarkup(slot: PredictionEmbedSlot): string {
  return `<div class="dear-prediction-embed" data-question-id="${slot.questionId}" data-view-url="${slot.viewUrl.replace(/"/g, "&quot;")}"></div>`;
}

function replaceBareUrlsInHtml(html: string, slots: PredictionEmbedSlot[]): string {
  let next = html;
  for (const link of findCreativeTvPredictionLinks(html)) {
    const escaped = link.matchedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bare = new RegExp(escaped, "gi");
    next = next.replace(bare, slotMarkup(link));
    if (!slots.some((s) => s.questionId === link.questionId)) {
      slots.push({ questionId: link.questionId, viewUrl: link.viewUrl });
    }
  }
  return next;
}

/**
 * Replace Creative TV `/predict/{questionId}` links with sanitized embed placeholders.
 */
export function transformPredictionLinksInArticleHtml(html: string): {
  html: string;
  slots: PredictionEmbedSlot[];
} {
  if (!html.trim()) {
    return { html, slots: [] };
  }

  const slots: PredictionEmbedSlot[] = [];
  let next = html;

  next = next.replace(ANCHOR_PREDICT_REGEX, (full, href: string) => {
    const parsed = parseCreativeTvPredictionUrl(href);
    if (!parsed) return full;
    if (!slots.some((s) => s.questionId === parsed.questionId)) {
      slots.push({ questionId: parsed.questionId, viewUrl: parsed.viewUrl });
    }
    return slotMarkup(parsed);
  });

  next = replaceBareUrlsInHtml(next, slots);

  return { html: next, slots };
}

export function extractPredictionEmbedSlots(html: string): PredictionEmbedSlot[] {
  const slots: PredictionEmbedSlot[] = [];
  const re =
    /data-question-id="(0x[a-fA-F0-9]{64})"[^>]*data-view-url="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const questionId = match[1]!.toLowerCase() as `0x${string}`;
    if (!slots.some((s) => s.questionId === questionId)) {
      slots.push({ questionId, viewUrl: match[2]! });
    }
  }
  return slots;
}

export type PostBodySegment =
  | { kind: "html"; html: string }
  | { kind: "embed"; slot: PredictionEmbedSlot };

export function splitPostBodyByPredictionEmbeds(html: string): PostBodySegment[] {
  const segments: PostBodySegment[] = [];
  const pattern =
    /<div class="dear-prediction-embed" data-question-id="(0x[a-fA-F0-9]{64})" data-view-url="([^"]+)"><\/div>/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: "html", html: html.slice(lastIndex, match.index) });
    }
    segments.push({
      kind: "embed",
      slot: {
        questionId: match[1]!.toLowerCase() as `0x${string}`,
        viewUrl: match[2]!,
      },
    });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < html.length) {
    segments.push({ kind: "html", html: html.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ kind: "html", html });
  }

  return segments;
}
