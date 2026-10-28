"use client";

import { useCallback, useState } from "react";
import { deliverNewsletterEmailFromStudio } from "@/lib/adam/repurpose/deliver-newsletter-from-studio";
import {
  readNewsletterIncludesFromSession,
  writeNewsletterIncludesToSession,
} from "@/lib/adam/repurpose/newsletter-includes";
import {
  repurposeNewsletterIncludeTypes,
  repurposeOutputLabel,
  type RepurposeNewsletterIncludeType,
} from "@/lib/adam/repurpose/types";

type NewsletterRepurposeIncludesProps = {
  postId: string;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
};

export function NewsletterRepurposeIncludes({
  postId,
  authFetch,
}: NewsletterRepurposeIncludesProps) {
  const [selected, setSelected] = useState<RepurposeNewsletterIncludeType[]>(() =>
    readNewsletterIncludesFromSession(postId),
  );
  const [dryRunStatus, setDryRunStatus] = useState<string | null>(null);
  const [dryRunBusy, setDryRunBusy] = useState(false);

  const toggle = useCallback(
    (type: RepurposeNewsletterIncludeType) => {
      setSelected((prev) => {
        const next = prev.includes(type)
          ? prev.filter((t) => t !== type)
          : [...prev, type];
        writeNewsletterIncludesToSession(postId, next);
        return next;
      });
    },
    [postId],
  );

  const handleDryRun = useCallback(async () => {
    setDryRunBusy(true);
    setDryRunStatus(null);
    try {
      const res = await deliverNewsletterEmailFromStudio({
        authFetch,
        postId,
        dryRun: true,
      });
      const data = (await res.json()) as { outcome?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Dry-run failed");
      }
      setDryRunStatus(
        data.outcome === "sent"
          ? "Dry-run OK — selected repurpose sections will append on live send."
          : `Dry-run: ${data.outcome ?? "unknown"}`,
      );
    } catch (err) {
      setDryRunStatus(err instanceof Error ? err.message : "Dry-run failed");
    } finally {
      setDryRunBusy(false);
    }
  }, [authFetch, postId]);

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
        Include in newsletter email
      </p>
      <p className="mt-0.5 text-[10px] text-zinc-500">
        Email-safe HTML for ready repurpose outputs. Choices are saved in this
        browser session and sent with newsletter delivery from here.
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {repurposeNewsletterIncludeTypes.map((type) => {
          const checked = selected.includes(type);
          return (
            <li key={type}>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-900">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(type)}
                  className="h-3 w-3 accent-violet-600"
                />
                {repurposeOutputLabel(type)}
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={dryRunBusy}
        onClick={() => void handleDryRun()}
        className="mt-2 rounded-md border border-violet-300 bg-white px-2.5 py-1 text-[10px] font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-200"
      >
        {dryRunBusy ? "Running dry-run…" : "Dry-run newsletter send"}
      </button>
      {dryRunStatus ? (
        <p className="mt-1.5 text-[10px] text-zinc-600 dark:text-zinc-400">
          {dryRunStatus}
        </p>
      ) : null}
    </div>
  );
}
