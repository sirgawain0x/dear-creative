export const repurposeOutputTypes = [
  "audio_overview",
  "slide_deck",
  "video_overview",
  "mind_map",
  "report",
  "flashcards",
  "quiz",
  "data_table",
  "infographic",
] as const;

export type RepurposeOutputType = (typeof repurposeOutputTypes)[number];

/** Writer-facing Repurpose panel (posts already have recorded TTS narration). */
export const repurposePanelOutputTypes = [
  "slide_deck",
  "video_overview",
  "mind_map",
  "report",
  "flashcards",
  "quiz",
  "data_table",
  "infographic",
] as const satisfies readonly RepurposeOutputType[];

export type RepurposePanelOutputType =
  (typeof repurposePanelOutputTypes)[number];

/** Text/structured outputs readers see on the post page and in email. */
export const repurposeReaderOutputTypes = [
  "slide_deck",
  "video_overview",
  "mind_map",
  "report",
  "flashcards",
  "quiz",
  "data_table",
  "infographic",
] as const satisfies readonly RepurposeOutputType[];

export type RepurposeReaderOutputType =
  (typeof repurposeReaderOutputTypes)[number];

/** Repurpose formats that can be appended to newsletter HTML (email-safe). */
export const repurposeNewsletterIncludeTypes = [
  "slide_deck",
  "video_overview",
  "mind_map",
  "report",
  "flashcards",
  "quiz",
  "data_table",
  "infographic",
] as const satisfies readonly RepurposeOutputType[];

export type RepurposeNewsletterIncludeType =
  (typeof repurposeNewsletterIncludeTypes)[number];

export const repurposeTextOutputTypes = [
  "slide_deck",
  "mind_map",
  "report",
  "flashcards",
  "quiz",
  "data_table",
] as const satisfies readonly RepurposeOutputType[];

export type RepurposeTextOutputType = (typeof repurposeTextOutputTypes)[number];

export const repurposeMediaOutputTypes = [
  "audio_overview",
  "video_overview",
  "infographic",
] as const satisfies readonly RepurposeOutputType[];

export const repurposePanelMediaOutputTypes = [
  "video_overview",
  "infographic",
] as const satisfies readonly RepurposePanelOutputType[];

export type RepurposeOutputStatus = "generating" | "ready" | "failed";

export type RepurposeStoredOutput = {
  id: string;
  postId: string;
  outputType: RepurposeOutputType;
  status: RepurposeOutputStatus;
  payload: unknown;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isRepurposeOutputType(value: string): value is RepurposeOutputType {
  return (repurposeOutputTypes as readonly string[]).includes(value);
}

export function isRepurposePanelOutputType(
  value: string,
): value is RepurposePanelOutputType {
  return (repurposePanelOutputTypes as readonly string[]).includes(value);
}

export function isRepurposeNewsletterIncludeType(
  value: string,
): value is RepurposeNewsletterIncludeType {
  return (repurposeNewsletterIncludeTypes as readonly string[]).includes(value);
}

export function repurposeOutputLabel(type: RepurposeOutputType): string {
  switch (type) {
    case "audio_overview":
      return "Audio Overview";
    case "slide_deck":
      return "Slide Deck";
    case "video_overview":
      return "Video Overview";
    case "mind_map":
      return "Mind Map";
    case "report":
      return "Report";
    case "flashcards":
      return "Flashcards";
    case "quiz":
      return "Quiz";
    case "data_table":
      return "Data Table";
    case "infographic":
      return "Infographic";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
