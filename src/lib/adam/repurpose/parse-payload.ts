import { z } from "zod";
import type { RepurposeOutputType } from "./types";

const mindMapNodeLevel3 = z.object({
  label: z.string().min(1),
});

const mindMapNodeLevel2 = z.object({
  label: z.string().min(1),
  children: z.array(mindMapNodeLevel3).default([]),
});

const mindMapNodeLevel1 = z.object({
  label: z.string().min(1),
  children: z.array(mindMapNodeLevel2).default([]),
});

export const mindMapPayloadSchema = z.object({
  title: z.string().min(1),
  root: mindMapNodeLevel1,
});

export const reportPayloadSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        body: z.string().min(1),
        bullets: z.array(z.string()).optional(),
      }),
    )
    .min(1),
  keyTakeaways: z.array(z.string()).min(1),
});

export const flashcardsPayloadSchema = z.object({
  title: z.string().min(1),
  cards: z
    .array(
      z.object({
        front: z.string().min(1),
        back: z.string().min(1),
      }),
    )
    .min(1),
});

export const quizPayloadSchema = z.object({
  title: z.string().min(1),
  questions: z
    .array(
      z
        .object({
          prompt: z.string().min(1),
          choices: z.array(z.string().min(1)).min(2),
          correctIndex: z.number().int().nonnegative(),
          explanation: z.string().min(1),
        })
        .superRefine((question, ctx) => {
          if (question.correctIndex >= question.choices.length) {
            ctx.addIssue({
              code: "custom",
              message: "correctIndex out of range",
              path: ["correctIndex"],
            });
          }
        }),
    )
    .min(1),
});

export const dataTablePayloadSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(z.array(z.string())).min(1),
});

export const slideDeckPayloadSchema = z.object({
  title: z.string().min(1),
  slides: z
    .array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string()).min(1),
        speakerNotes: z.string().optional(),
      }),
    )
    .min(1),
});

export type ParsedRepurposePayload<T extends RepurposeOutputType> =
  T extends "mind_map"
    ? z.infer<typeof mindMapPayloadSchema>
    : T extends "report"
      ? z.infer<typeof reportPayloadSchema>
      : T extends "flashcards"
        ? z.infer<typeof flashcardsPayloadSchema>
        : T extends "quiz"
          ? z.infer<typeof quizPayloadSchema>
          : T extends "data_table"
            ? z.infer<typeof dataTablePayloadSchema>
            : T extends "slide_deck"
              ? z.infer<typeof slideDeckPayloadSchema>
              : unknown;

export function parseRepurposePayload<T extends RepurposeOutputType>(
  outputType: T,
  payload: unknown,
):
  | { ok: true; data: ParsedRepurposePayload<T> }
  | { ok: false; error: string } {
  const schema = schemaForOutputType(outputType);
  if (!schema) {
    return { ok: false, error: "Unsupported output type for parsing" };
  }
  const result = schema.safeParse(payload);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, data: result.data as ParsedRepurposePayload<T> };
}

function schemaForOutputType(outputType: RepurposeOutputType): z.ZodType | null {
  switch (outputType) {
    case "mind_map":
      return mindMapPayloadSchema;
    case "report":
      return reportPayloadSchema;
    case "flashcards":
      return flashcardsPayloadSchema;
    case "quiz":
      return quizPayloadSchema;
    case "data_table":
      return dataTablePayloadSchema;
    case "slide_deck":
      return slideDeckPayloadSchema;
    default:
      return null;
  }
}
