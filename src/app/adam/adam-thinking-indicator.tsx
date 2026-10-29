"use client";

export type AdamThinkingIndicatorProps = {
  reducedMotion?: boolean;
  /** Optional test id for screenshots and component tests */
  "data-testid"?: string;
};

export function AdamThinkingIndicator({
  reducedMotion = false,
  "data-testid": testId = "adam-thinking-indicator",
}: AdamThinkingIndicatorProps) {
  return (
    <div
      data-testid={testId}
      aria-hidden="true"
      className="flex items-center gap-1.5 py-0.5"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500 ${
            reducedMotion ? "opacity-80" : "adam-thinking-dot"
          }`}
          style={
            reducedMotion
              ? undefined
              : { animationDelay: `${index * 0.16}s` }
          }
        />
      ))}
    </div>
  );
}
