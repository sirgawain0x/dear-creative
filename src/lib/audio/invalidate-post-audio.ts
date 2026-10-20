import type { CorePostRow } from "@/db/ensure-schema";
import { buildNarrationScript } from "@/lib/audio/narration";

/** True when the spoken narration script (title, teaser, body) would change. */
export function postNarrationContentChanged(
  existing: CorePostRow,
  resolved: {
    title: string;
    teaserText: string | null;
    bodyHtml: string | null;
  },
): boolean {
  const before = buildNarrationScript({
    title: existing.title,
    teaserText: existing.teaserText,
    bodyHtml: existing.bodyHtml,
  });
  const after = buildNarrationScript({
    title: resolved.title,
    teaserText: resolved.teaserText,
    bodyHtml: resolved.bodyHtml,
  });
  return before !== after;
}
