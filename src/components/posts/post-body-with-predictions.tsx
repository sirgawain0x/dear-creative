import { PredictionLinkEmbedCard } from "@/components/predictions/prediction-link-embed-card";
import {
  fetchPredictionEmbedCached,
  type PredictionEmbedData,
} from "@/lib/predictions/fetch-prediction-embed";
import {
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
  const { html: withSlots, slots } = transformPredictionLinksInArticleHtml(bodyHtml);
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
