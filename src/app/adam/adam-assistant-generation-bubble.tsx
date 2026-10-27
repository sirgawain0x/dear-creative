"use client";

import type { AdamAgentGenerationPhase } from "@/app/adam/adam-agent-generation-state";
import { AdamStreamingCue } from "@/app/adam/adam-streaming-cue";
import { AdamThinkingIndicator } from "@/app/adam/adam-thinking-indicator";
export type AdamAssistantGenerationBubbleProps = {
  phase: Extract<AdamAgentGenerationPhase, "waiting" | "streaming">;
  content: string;
  reducedMotion?: boolean;
};

export function AdamAssistantGenerationBubble({
  phase,
  content,
  reducedMotion = false,
}: AdamAssistantGenerationBubbleProps) {
  const showStreamingCue = phase === "streaming" && content.length > 0;

  return (
    <div
      data-testid="adam-assistant-generation-bubble"
      data-generation-phase={phase}
      className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
        phase === "streaming"
          ? "border-emerald-200/80 bg-zinc-50 text-zinc-900 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)] dark:border-emerald-900/50 dark:bg-zinc-900 dark:text-zinc-100"
          : "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
      }`}
    >
      <div className="mb-1 text-xs font-semibold opacity-70">Adam</div>
      {phase === "waiting" ? (
        <AdamThinkingIndicator reducedMotion={reducedMotion} />
      ) : (
        <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed">
          {content}
          {showStreamingCue ? (
            <AdamStreamingCue reducedMotion={reducedMotion} />
          ) : null}
        </p>
      )}
    </div>
  );
}
