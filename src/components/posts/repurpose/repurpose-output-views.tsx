import {
  parseRepurposePayload,
  mindMapPayloadSchema,
  reportPayloadSchema,
  flashcardsPayloadSchema,
  quizPayloadSchema,
  dataTablePayloadSchema,
  slideDeckPayloadSchema,
} from "@/lib/adam/repurpose/parse-payload";
import {
  repurposeOutputLabel,
  type RepurposeStoredOutput,
  type RepurposeTextOutputType,
} from "@/lib/adam/repurpose/types";
import type { z } from "zod";

type MindMapPayload = z.infer<typeof mindMapPayloadSchema>;
type ReportPayload = z.infer<typeof reportPayloadSchema>;
type FlashcardsPayload = z.infer<typeof flashcardsPayloadSchema>;
type QuizPayload = z.infer<typeof quizPayloadSchema>;
type DataTablePayload = z.infer<typeof dataTablePayloadSchema>;
type SlideDeckPayload = z.infer<typeof slideDeckPayloadSchema>;

function MalformedFallback({ label }: { label: string }) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400">
      {label} could not be displayed — the stored data is incomplete or invalid.
    </p>
  );
}

function MindMapView({ data }: { data: MindMapPayload }) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {data.title}
      </h4>
      <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
        <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
          {data.root.label}
        </p>
        <ul className="mt-3 space-y-3 border-l-2 border-violet-300 pl-4 dark:border-violet-700">
          {data.root.children.map((branch, bi) => (
            <li key={`${branch.label}-${bi}`}>
              <p className="text-sm font-medium">{branch.label}</p>
              {branch.children.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                  {branch.children.map((leaf, li) => (
                    <li key={`${leaf.label}-${li}`}>{leaf.label}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ReportView({ data }: { data: ReportPayload }) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">{data.title}</h4>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{data.summary}</p>
      {data.sections.map((section, si) => (
        <div key={`${section.heading}-${si}`} className="space-y-2">
          <h5 className="text-sm font-semibold">{section.heading}</h5>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{section.body}</p>
          {section.bullets?.length ? (
            <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
              {section.bullets.map((b, bi) => (
                <li key={bi}>{b}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Key takeaways
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {data.keyTakeaways.map((t, ti) => (
            <li key={ti}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SlideDeckView({ data }: { data: SlideDeckPayload }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{data.title}</h4>
      {data.slides.map((slide, idx) => (
        <div
          key={`${slide.title}-${idx}`}
          className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="text-sm font-medium">
            {idx + 1}. {slide.title}
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            {slide.bullets.map((b, bi) => (
              <li key={bi}>{b}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FlashcardsView({ data }: { data: FlashcardsPayload }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{data.title}</h4>
      <ul className="grid gap-2 sm:grid-cols-2">
        {data.cards.map((card, ci) => (
          <li
            key={ci}
            className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{card.front}</p>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">{card.back}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuizView({ data }: { data: QuizPayload }) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">{data.title}</h4>
      <ol className="space-y-4">
        {data.questions.map((q, qi) => (
          <li key={qi} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-sm font-medium">
              {qi + 1}. {q.prompt}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {q.choices.map((choice, ci) => (
                <li
                  key={ci}
                  className={
                    ci === q.correctIndex
                      ? "font-medium text-emerald-700 dark:text-emerald-400"
                      : undefined
                  }
                >
                  {String.fromCharCode(65 + ci)}. {choice}
                  {ci === q.correctIndex ? " ✓" : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-zinc-500">{q.explanation}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DataTableView({ data }: { data: DataTablePayload }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{data.title}</h4>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{data.description}</p>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              {data.columns.map((col, ci) => (
                <th key={ci} className="px-3 py-2 font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                {data.columns.map((_, ci) => (
                  <td key={ci} className="px-3 py-2 align-top">
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TextPayloadView({
  outputType,
  payload,
}: {
  outputType: RepurposeTextOutputType;
  payload: unknown;
}) {
  const parsed = parseRepurposePayload(outputType, payload);
  if (!parsed.ok) {
    return <MalformedFallback label={repurposeOutputLabel(outputType)} />;
  }
  switch (outputType) {
    case "mind_map":
      return <MindMapView data={parsed.data as MindMapPayload} />;
    case "report":
      return <ReportView data={parsed.data as ReportPayload} />;
    case "slide_deck":
      return <SlideDeckView data={parsed.data as SlideDeckPayload} />;
    case "flashcards":
      return <FlashcardsView data={parsed.data as FlashcardsPayload} />;
    case "quiz":
      return <QuizView data={parsed.data as QuizPayload} />;
    case "data_table":
      return <DataTableView data={parsed.data as DataTablePayload} />;
    default: {
      const _exhaustive: never = outputType;
      return _exhaustive;
    }
  }
}

export function RepurposeOutputCard({
  output,
}: {
  output: RepurposeStoredOutput;
}) {
  const label = repurposeOutputLabel(output.outputType);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
        {label}
      </h3>
      <div className="mt-3">
        {output.outputType === "video_overview" && output.mediaUrl ? (
          <video
            controls
            preload="metadata"
            src={output.mediaUrl}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
          >
            <track kind="captions" />
          </video>
        ) : null}
        {output.outputType === "infographic" && output.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={output.mediaUrl}
            alt={`${label} for this post`}
            className="max-h-96 w-full rounded-lg object-contain"
          />
        ) : null}
        {(output.outputType === "mind_map" ||
          output.outputType === "report" ||
          output.outputType === "slide_deck" ||
          output.outputType === "flashcards" ||
          output.outputType === "quiz" ||
          output.outputType === "data_table") &&
        output.payload ? (
          <TextPayloadView
            outputType={output.outputType}
            payload={output.payload}
          />
        ) : null}
      </div>
    </section>
  );
}
