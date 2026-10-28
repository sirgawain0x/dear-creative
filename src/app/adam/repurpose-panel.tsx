"use client";

import { useCallback, useEffect, useState } from "react";
import { RepurposeOutputCard } from "@/components/posts/repurpose/repurpose-output-views";
import {
  repurposePanelMediaOutputTypes,
  repurposePanelOutputTypes,
  repurposeOutputLabel,
  type RepurposePanelOutputType,
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

function initialRows(): Record<RepurposePanelOutputType, OutputRowState> {
  const rows = {} as Record<RepurposePanelOutputType, OutputRowState>;
  for (const type of repurposePanelOutputTypes) {
    rows[type] = { output: null, isGenerating: false };
  }
  return rows;
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
        for (const type of repurposePanelOutputTypes) {
          next[type] = { ...next[type], output: null };
        }
        for (const output of data.outputs ?? []) {
          if (!(repurposePanelOutputTypes as readonly string[]).includes(output.outputType)) {
            continue;
          }
          next[output.outputType as RepurposePanelOutputType] = {
            output,
            isGenerating: output.status === "generating",
          };
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
    async (type: RepurposePanelOutputType) => {
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
        {repurposePanelOutputTypes.map((type) => {
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
              {row.output?.status === "ready" &&
              (repurposePanelMediaOutputTypes as readonly string[]).includes(type) &&
              row.output.mediaUrl ? (
                <div className="mt-2 space-y-1">
                  {row.output.mediaMimeType?.startsWith("video/") ? (
                    <video
                      controls
                      preload="metadata"
                      src={row.output.mediaUrl}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
                    >
                      <track kind="captions" />
                    </video>
                  ) : null}
                  {type === "infographic" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.output.mediaUrl}
                      alt="Generated infographic"
                      className="max-h-64 w-full rounded-lg object-contain"
                    />
                  ) : null}
                  <a
                    href={row.output.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono underline"
                  >
                    Lens Grove media ↗
                  </a>
                </div>
              ) : null}
              {row.output?.status === "ready" && row.output.payload ? (
                <div className="mt-2 [&_section]:border-0 [&_section]:p-0 [&_section]:shadow-none">
                  <RepurposeOutputCard output={row.output} />
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
