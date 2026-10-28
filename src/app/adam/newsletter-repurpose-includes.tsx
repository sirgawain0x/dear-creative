"use client";

import { useCallback, useState } from "react";
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
};

export function NewsletterRepurposeIncludes({
  postId,
}: NewsletterRepurposeIncludesProps) {
  const [selected, setSelected] = useState<RepurposeNewsletterIncludeType[]>(() =>
    readNewsletterIncludesFromSession(postId),
  );

  const toggle = useCallback(
    (type: RepurposeNewsletterIncludeType) => {
      if (!postId) {
        return;
      }
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

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
        Include in newsletter email
      </p>
      <p className="mt-0.5 text-[10px] text-zinc-500">
        Email-safe HTML for ready repurpose outputs. Choices are saved in this
        browser session only (no database change).
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
    </div>
  );
}

/** Read includes for API calls (deliver email). */
export function getNewsletterRepurposeIncludesForPost(
  postId: string,
): RepurposeNewsletterIncludeType[] {
  return readNewsletterIncludesFromSession(postId);
}
