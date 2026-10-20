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

const mindMapSchema = z.object({
  title: z.string().min(1),
  root: mindMapNodeLevel1,
});

const reportSchema = z.object({
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

const flashcardsSchema = z.object({
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

const quizQuestionSchema = z
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
        message: "correctIndex must be within choices",
        path: ["correctIndex"],
      });
    }
  });

const quizSchema = z.object({
  title: z.string().min(1),
  questions: z.array(quizQuestionSchema).min(1),
});

const dataTableSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(z.array(z.string())).min(1),
});

const slideDeckSchema = z.object({
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

const podcastScriptSchema = z
  .object({
    title: z.string().min(1).optional(),
    intro: z.string().optional(),
    segments: z
      .array(
        z.object({
          speaker: z.enum(["host_a", "host_b"]),
          text: z.string().min(1),
        }),
      )
      .optional(),
    outro: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasIntro = Boolean(value.intro?.trim());
    const hasOutro = Boolean(value.outro?.trim());
    const hasSegment = Boolean(
      value.segments?.some((segment) => segment.text.trim().length > 0),
    );
    if (!hasIntro && !hasOutro && !hasSegment) {
      ctx.addIssue({
        code: "custom",
        message: "Podcast script has no speakable content",
        path: ["segments"],
      });
    }
  });

const videoPayloadSchema = z.object({
  slideDeck: slideDeckSchema,
  mode: z.literal("narrated_slides"),
});

const infographicPayloadSchema = z.object({
  model: z.string().min(1),
  promptTitle: z.string().min(1),
});

export function validateRepurposeModelOutput(
  outputType: RepurposeOutputType,
  payload: unknown,
): unknown {
  switch (outputType) {
    case "mind_map":
      return mindMapSchema.parse(payload);
    case "report":
      return reportSchema.parse(payload);
    case "flashcards":
      return flashcardsSchema.parse(payload);
    case "quiz":
      return quizSchema.parse(payload);
    case "data_table":
      return dataTableSchema.parse(payload);
    case "slide_deck":
      return slideDeckSchema.parse(payload);
    case "audio_overview":
      return podcastScriptSchema.parse(payload);
    case "video_overview":
      return videoPayloadSchema.parse(payload);
    case "infographic":
      return infographicPayloadSchema.parse(payload);
    default: {
      const _exhaustive: never = outputType;
      throw new Error(`Unsupported output type: ${_exhaustive}`);
    }
  }
}
