import {
  repurposeOutputTypes,
  type RepurposeOutputType,
} from "@/lib/adam/repurpose/types";

/** Studio billable outputs that are not NotebookLM-style repurpose artifacts. */
export const studioNativeOutputTypes = [
  "banner",
  "narration",
  "adam_video_8s",
] as const;

export type StudioNativeOutputType = (typeof studioNativeOutputTypes)[number];

/** Every Studio output that can carry a USDC list price (repurpose + native). */
export const studioOutputTypes = [
  ...repurposeOutputTypes,
  ...studioNativeOutputTypes,
] as const;

export type StudioOutputType = (typeof studioOutputTypes)[number];

/** Ensures repurpose enum strings stay in sync with the studio price table. */
type _RepurposeOutputsAreStudioOutputs = RepurposeOutputType extends StudioOutputType
  ? true
  : false;

const _repurposeSubsetCheck: _RepurposeOutputsAreStudioOutputs = true;

void _repurposeSubsetCheck;

export function isStudioOutputType(value: string): value is StudioOutputType {
  return (studioOutputTypes as readonly string[]).includes(value);
}
