import { PredictionLinkEmbedCard } from "@/components/predictions/prediction-link-embed-card";
import {
  fetchPredictionEmbedCached,
  type PredictionEmbedData,
} from "@/lib/predictions/fetch-prediction-embed";
import {
  extractPredictionEmbedSlots,
  splitPostBodyByPredictionEmbeds,
  transformPredictionLinksInArticleHtml,
  type PredictionEmbedSlot,
} from "@/lib/predictions/transform-prediction-links-in-html";

async function loadEmbeds(
  slots: PredictionEmbedSlot[],
): Promise<Map<string, PredictionEmbedData | null>> {
  const map = new Map<string, PredictionEmbedData | null>();
  await Promise.all(
    slots.map(async (slot) => {
      const result = await fetchPredictionEmbedCached(
        slot.questionId,
        slot.viewUrl,
      );
      map.set(
        slot.questionId,
        result.ok ? result : null,
      );
    }),
  );
  return map;
}

export async function PostBodyWithPredictions({
  bodyHtml,
}: {
  bodyHtml: string;
}) {
  const { html: withSlots, slots: transformSlots } =
    transformPredictionLinksInArticleHtml(bodyHtml);
  // Bodies stored from markdown already contain dear-prediction-embed
  // placeholders; the transform only reports slots for links it rewrote.
  // Merge in the pre-existing placeholders so their chain data is fetched
  // too — otherwise those cards always render without data.
  const slots = [...transformSlots];
  const seen = new Set(slots.map((slot) => slot.questionId));
  for (const slot of extractPredictionEmbedSlots(bodyHtml)) {
    if (!seen.has(slot.questionId)) {
      seen.add(slot.questionId);
      slots.push(slot);
    }
  }
  const embedData = slots.length > 0 ? await loadEmbeds(slots) : new Map();
  const segments = splitPostBodyByPredictionEmbeds(withSlots);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === "html") {
          if (!segment.html.trim()) return null;
          return (
            <div
              key={`html-${index}`}
              className="prose prose-zinc dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: segment.html }}
            />
          );
        }

        const data = embedData.get(segment.slot.questionId) ?? null;
        const failed = slots.length > 0 && data === null;

        return (
          <PredictionLinkEmbedCard
            key={`embed-${segment.slot.questionId}-${index}`}
            data={data}
            viewUrl={segment.slot.viewUrl}
            fallbackLink={failed}
          />
        );
      })}
    </>
  );
}
