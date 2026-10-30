import {
  findCreativeTvPredictionLinks,
  parseCreativeTvPredictionUrl,
  resolveTrustedPredictionViewUrl,
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

/**
 * Replace bare prediction URLs in *text* segments only. Splitting on tags
 * keeps URLs that live inside markup — `href`/`src` attributes and the
 * `data-view-url` of placeholders this module (or the markdown pass) already
 * emitted — untouched, so a placeholder can never be corrupted by nesting a
 * second embed div inside its own attribute.
 */
function replaceBareUrlsInHtml(html: string, slots: PredictionEmbedSlot[]): string {
  const segments = html.split(/(<[^>]*>)/g);
  return segments
    .map((segment) => {
      if (segment.startsWith("<")) {
        return segment;
      }
      let text = segment;
      for (const link of findCreativeTvPredictionLinks(segment)) {
        const escaped = link.matchedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        text = text.replace(new RegExp(escaped, "gi"), slotMarkup(link));
        if (!slots.some((s) => s.questionId === link.questionId)) {
          slots.push({ questionId: link.questionId, viewUrl: link.viewUrl });
        }
      }
      return text;
    })
    .join("");
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
      slots.push({
        questionId,
        viewUrl: resolveTrustedPredictionViewUrl(questionId, match[2]!),
      });
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
    const questionId = match[1]!.toLowerCase() as `0x${string}`;
    segments.push({
      kind: "embed",
      slot: {
        questionId,
        // Placeholder markup can carry an arbitrary data-view-url; only a
        // trusted Creative TV URL for this question may be rendered.
        viewUrl: resolveTrustedPredictionViewUrl(questionId, match[2]!),
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
