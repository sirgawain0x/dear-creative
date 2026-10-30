import { PredictionLinkEmbedCard } from "@/components/predictions/prediction-link-embed-card";

/** Static fixture for docs screenshots (mocked chain data). */
export default function PredictionEmbedFixturePage() {
  const questionId =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const viewUrl = `https://tv.creativeplatform.xyz/predict/${questionId}`;

  return (
    <main className="mx-auto max-w-xl bg-white p-8 dark:bg-zinc-950">
      <PredictionLinkEmbedCard
        viewUrl={viewUrl}
        data={{
          ok: true,
          questionId,
          viewUrl,
          title: "Will the next Dear Creative dispatch mention Creative TV?",
          outcomes: ["No", "Yes"],
          category: "editorial",
          status: "bonding",
          resultLabel: null,
          minBondWei: "1000000000000000",
          bondWei: "2500000000000000",
          openingTs: 1_700_000_000,
          timeoutSec: 86_400,
          finalizeTs: null,
        }}
      />
    </main>
  );
}
