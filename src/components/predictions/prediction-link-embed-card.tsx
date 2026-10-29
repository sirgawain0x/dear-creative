import { formatEther } from "viem";
import type { PredictionEmbedData } from "@/lib/predictions/fetch-prediction-embed";

export type PredictionLinkEmbedCardProps = {
  data: PredictionEmbedData | null;
  viewUrl: string;
  fallbackLink?: boolean;
};

function statusLabel(status: PredictionEmbedData["status"]): string {
  switch (status) {
    case "open":
      return "Open";
    case "bonding":
      return "Bonding";
    case "finalized":
      return "Finalized";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function PredictionLinkEmbedCard({
  data,
  viewUrl,
  fallbackLink = false,
}: PredictionLinkEmbedCardProps) {
  if (fallbackLink || !data) {
    return (
      <div className="my-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          View prediction on Creative TV ↗
        </a>
      </div>
    );
  }

  const bondText =
    data.minBondWei != null
      ? `${Number(formatEther(BigInt(data.minBondWei))).toFixed(4)} ETH min bond`
      : data.bondWei != null
        ? `${Number(formatEther(BigInt(data.bondWei))).toFixed(4)} ETH bond`
        : null;

  const isFinalized = data.status === "finalized";

  return (
    <div
      className="my-8 overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-50/50 via-zinc-50/60 to-fuchsia-50/30 p-6 shadow-sm dark:border-violet-500/20 dark:from-violet-950/25 dark:via-zinc-900/60 dark:to-fuchsia-950/20"
      data-testid="prediction-link-embed-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 pb-3 text-xs dark:border-zinc-800/60">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 font-medium text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">
            Creative TV · Read-only
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              isFinalized
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : data.status === "bonding"
                  ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : "bg-sky-500/10 text-sky-800 dark:text-sky-300"
            }`}
          >
            {statusLabel(data.status)}
          </span>
        </div>
        {bondText ? (
          <span className="font-mono text-[11px] text-zinc-500">{bondText}</span>
        ) : null}
      </div>

      <h3 className="mt-4 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {data.title}
      </h3>

      <div className="mt-4">
        {isFinalized && data.resultLabel ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
              Result
            </div>
            <div className="text-base font-bold">{data.resultLabel}</div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.outcomes.map((outcome) => (
              <span
                key={outcome}
                className="rounded-lg border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
              >
                {outcome}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-zinc-200/60 pt-3 text-xs dark:border-zinc-800/60">
        <a
          href={data.viewUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline dark:text-violet-300"
        >
          View on Creative TV ↗
        </a>
      </div>
    </div>
  );
}
