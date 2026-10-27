"use client";

export type AdamStreamingCueProps = {
  reducedMotion?: boolean;
  "data-testid"?: string;
};

/** Subtle cue shown while assistant text is still arriving. */
export function AdamStreamingCue({
  reducedMotion = false,
  "data-testid": testId = "adam-streaming-cue",
}: AdamStreamingCueProps) {
  return (
    <span
      data-testid={testId}
      aria-hidden="true"
      className={`ml-0.5 inline-block align-baseline text-emerald-600/80 dark:text-emerald-400/80 ${
        reducedMotion ? "opacity-70" : "adam-streaming-cursor"
      }`}
    >
      ▍
    </span>
  );
}
