"use client";

/** Screen-reader status for non-chat Adam work (formatting, repurpose, etc.). */
export function AdamAgentWorkingAnnouncer({
  busy,
  label,
}: {
  busy: boolean;
  label: string;
}) {
  if (!busy) return null;
  return (
    <span
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="adam-agent-working-announcer"
    >
      {label}
    </span>
  );
}
