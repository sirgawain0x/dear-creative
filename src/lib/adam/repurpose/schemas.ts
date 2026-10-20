import type { RepurposeOutputType } from "./types";

/** Gemini responseSchema payloads keyed by output type (NotebookLM-style structured JSON). */
export function getRepurposeResponseSchema(
  outputType: RepurposeOutputType,
): Record<string, unknown> {
  switch (outputType) {
    case "mind_map":
      return {
        type: "object",
        properties: {
          title: { type: "string" },
          root: { $ref: "#/$defs/node" },
        },
        required: ["title", "root"],
        $defs: {
          node: {
            type: "object",
            properties: {
              label: { type: "string" },
              children: {
                type: "array",
                items: { $ref: "#/$defs/node" },
              },
            },
            required: ["label", "children"],
          },
        },
      };
    case "report":
      return {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                body: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
              },
              required: ["heading", "body"],
            },
          },
          keyTakeaways: { type: "array", items: { type: "string" } },
        },
        required: ["title", "summary", "sections", "keyTakeaways"],
      };
    case "flashcards":
      return {
        type: "object",
        properties: {
          title: { type: "string" },
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                front: { type: "string" },
                back: { type: "string" },
              },
              required: ["front", "back"],
            },
          },
        },
        required: ["title", "cards"],
      };
    case "quiz":
      return {
        type: "object",
        properties: {
          title: { type: "string" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                choices: { type: "array", items: { type: "string" } },
                correctIndex: { type: "integer" },
                explanation: { type: "string" },
              },
              required: ["prompt", "choices", "correctIndex", "explanation"],
            },
          },
        },
        required: ["title", "questions"],
      };
    case "data_table":
      return {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          columns: { type: "array", items: { type: "string" } },
          rows: {
            type: "array",
            items: { type: "array", items: { type: "string" } },
          },
        },
        required: ["title", "description", "columns", "rows"],
      };
    case "slide_deck":
      return {
        type: "object",
        properties: {
          title: { type: "string" },
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
                speakerNotes: { type: "string" },
              },
              required: ["title", "bullets"],
            },
          },
        },
        required: ["title", "slides"],
      };
    case "audio_overview":
      return {
        type: "object",
        properties: {
          title: { type: "string" },
          intro: { type: "string" },
          segments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                speaker: { type: "string", enum: ["host_a", "host_b"] },
                text: { type: "string" },
              },
              required: ["speaker", "text"],
            },
          },
          outro: { type: "string" },
        },
        required: ["title", "segments"],
      };
    default:
      return {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
        },
        required: ["title", "summary"],
      };
  }
}

export function getRepurposeGenerationPrompt(
  outputType: RepurposeOutputType,
  source: { title: string; plainText: string },
): string {
  const base = `Source article title: ${source.title}\n\nSource text:\n${source.plainText.slice(0, 120_000)}`;
  switch (outputType) {
    case "mind_map":
      return `${base}\n\nCreate a hierarchical mind map of the key ideas. Use concise node labels.`;
    case "report":
      return `${base}\n\nWrite a structured analytical report with clear sections and actionable takeaways.`;
    case "flashcards":
      return `${base}\n\nCreate 8-14 study flashcards covering the most important concepts.`;
    case "quiz":
      return `${base}\n\nCreate a 5-8 question multiple-choice quiz with explanations.`;
    case "data_table":
      return `${base}\n\nExtract comparable facts into a tabular dataset (3-6 columns, 5-12 rows).`;
    case "slide_deck":
      return `${base}\n\nOutline an 8-12 slide deck. Each slide needs a title and 2-5 bullets plus optional speaker notes.`;
    case "audio_overview":
      return `${base}\n\nWrite a two-host podcast script (host_a and host_b) that discusses the article in a conversational, NotebookLM-style audio overview. Include intro/outro when helpful.`;
    default:
      return `${base}\n\nSummarize the source material.`;
  }
}
