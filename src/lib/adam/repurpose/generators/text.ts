import { generateRepurposeStructuredJson } from "../gemini-json";
import type { RepurposePostSource } from "../post-source";
import type { RepurposeOutputType } from "../types";
import { repurposeTextOutputTypes } from "../types";

export type TextRepurposeResult = {
  payload: unknown;
  mediaUrl: null;
  mediaMimeType: null;
};

export function isTextRepurposeType(
  type: RepurposeOutputType,
): type is (typeof repurposeTextOutputTypes)[number] {
  return (repurposeTextOutputTypes as readonly string[]).includes(type);
}

export async function generateTextRepurposeOutput(input: {
  outputType: (typeof repurposeTextOutputTypes)[number];
  source: RepurposePostSource;
  fetchFn?: typeof fetch;
}): Promise<TextRepurposeResult> {
  const payload = await generateRepurposeStructuredJson({
    outputType: input.outputType,
    source: {
      title: input.source.title,
      plainText: input.source.plainText,
    },
    fetchFn: input.fetchFn,
  });
  return { payload, mediaUrl: null, mediaMimeType: null };
}
