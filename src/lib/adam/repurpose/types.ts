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

export const repurposeTextOutputTypes = [
  "slide_deck",
  "mind_map",
  "report",
  "flashcards",
  "quiz",
  "data_table",
] as const satisfies readonly RepurposeOutputType[];

export const repurposeMediaOutputTypes = [
  "audio_overview",
  "video_overview",
  "infographic",
] as const satisfies readonly RepurposeOutputType[];

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
