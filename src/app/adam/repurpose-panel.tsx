"use client";

import { useCallback, useEffect, useState } from "react";
import {
  repurposeOutputLabel,
  repurposeTextOutputTypes,
  type RepurposeOutputType,
  type RepurposeStoredOutput,
} from "@/lib/adam/repurpose/types";

type RepurposePanelProps = {
  postId: string | null;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
};

type OutputRowState = {
  output: RepurposeStoredOutput | null;
  isGenerating: boolean;
};

function initialRows(): Record<RepurposeOutputType, OutputRowState> {
  const rows = {} as Record<RepurposeOutputType, OutputRowState>;
  for (const type of repurposeTextOutputTypes) {
    rows[type] = { output: null, isGenerating: false };
  }
  return rows;
}

function SlideDeckPreview({ payload }: { payload: unknown }) {
  const deck = payload as {
    title?: string;
    slides?: Array<{ title?: string; bullets?: string[] }>;
  };
  if (!deck.slides?.length) {
    return (
      <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-950/80 p-2 text-[10px] text-zinc-300">
        {JSON.stringify(payload, null, 2)}
      </pre>
    );
  }
  return (
    <div className="max-h-48 space-y-2 overflow-auto">
      <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
        {deck.title}
      </p>
      {deck.slides.map((slide, idx) => (
        <div
          key={`${slide.title ?? "slide"}-${idx}`}
          className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="text-[11px] font-medium">
            {idx + 1}. {slide.title}
          </p>
          <ul className="mt-1 list-disc pl-4 text-[10px] text-zinc-600 dark:text-zinc-400">
            {(slide.bullets ?? []).map((b, bi) => (
              <li key={bi}>{b}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function JsonPreview({ payload }: { payload: unknown }) {
  return (
    <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-950/80 p-2 text-[10px] text-zinc-300">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

export function RepurposePanel({ postId, authFetch }: RepurposePanelProps) {
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState(initialRows);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOutputs = useCallback(
    async (activePostId: string) => {
      setLoadError(null);
      const res = await authFetch(
        `/api/adam/posts/${encodeURIComponent(activePostId)}/repurpose`,
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to load repurpose outputs");
      }
      const data = (await res.json()) as { outputs?: RepurposeStoredOutput[] };
      setRows((prev) => {
        const next = { ...prev };
        for (const type of repurposeTextOutputTypes) {
          next[type] = { ...next[type], output: null };
        }
        for (const output of data.outputs ?? []) {
          if ((repurposeTextOutputTypes as readonly string[]).includes(output.outputType)) {
            next[output.outputType as RepurposeOutputType] = {
              output,
              isGenerating: output.status === "generating",
            };
          }
        }
        return next;
      });
    },
    [authFetch],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const statusRes = await authFetch("/api/adam/repurpose/status");
        if (!statusRes.ok || cancelled) return;
        const statusData = (await statusRes.json()) as { enabled?: boolean };
        const flagOn = Boolean(statusData.enabled);
        if (cancelled) return;
        setEnabled(flagOn);
        if (flagOn && postId) {
          await loadOutputs(postId);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, loadOutputs, postId]);

  const handleGenerate = useCallback(
    async (type: RepurposeOutputType) => {
      if (!postId) return;
      setRows((prev) => ({
        ...prev,
        [type]: { ...prev[type], isGenerating: true },
      }));
      try {
        const res = await authFetch(
          `/api/adam/posts/${encodeURIComponent(postId)}/repurpose/${type}`,
          { method: "POST" },
        );
        const data = (await res.json()) as {
          output?: RepurposeStoredOutput;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Generation failed");
        }
        setRows((prev) => ({
          ...prev,
          [type]: {
            output: data.output ?? null,
            isGenerating: false,
          },
        }));
        if (postId) {
          await loadOutputs(postId);
        }
      } catch (err) {
        setRows((prev) => ({
          ...prev,
          [type]: { ...prev[type], isGenerating: false },
        }));
        setLoadError(err instanceof Error ? err.message : "Generation failed");
      }
    },
    [authFetch, loadOutputs, postId],
  );

  if (!enabled) {
    return null;
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
      <div className="mb-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <span>Repurpose</span>
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
            NotebookLM-style · Gemini
          </span>
        </h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Generate each format once per post. Outputs are stored for readers — never regenerated per visitor.
        </p>
        {loadError ? (
          <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{loadError}</p>
        ) : null}
      </div>

      <ul className="space-y-3">
        {repurposeTextOutputTypes.map((type) => {
          const row = rows[type];
          const status = row.output?.status;
          return (
            <li
              key={type}
              className="rounded-lg border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold">{repurposeOutputLabel(type)}</p>
                  <p className="text-[10px] text-zinc-500">
                    {status === "ready"
                      ? "Ready"
                      : status === "generating"
                        ? "Generating…"
                        : status === "failed"
                          ? "Failed — fix content and try again"
                          : "Not generated yet"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!postId || row.isGenerating || status === "ready"}
                  onClick={() => void handleGenerate(type)}
                  className="rounded-lg border border-violet-300 bg-violet-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-violet-500 disabled:opacity-50 dark:border-violet-700"
                >
                  {row.isGenerating
                    ? "Generating…"
                    : status === "ready"
                      ? "Generated"
                      : "Generate"}
                </button>
              </div>
              {row.output?.status === "ready" && row.output.payload ? (
                <div className="mt-2">
                  {type === "slide_deck" ? (
                    <SlideDeckPreview payload={row.output.payload} />
                  ) : (
                    <JsonPreview payload={row.output.payload} />
                  )}
                </div>
              ) : null}
              {row.output?.status === "failed" && row.output.errorMessage ? (
                <p className="mt-2 text-[10px] text-red-600">{row.output.errorMessage}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
