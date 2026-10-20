"use client";

import { useCallback, useState } from "react";
import { basescanAddressUrl } from "@/lib/admin/payout-address";

export function AdminPayoutAddressRow({
  label,
  address,
}: {
  label: string;
  address: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    if (!address || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        {label}
      </p>
      {address ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs font-mono text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
            {address}
          </code>
          <button
            type="button"
            onClick={() => void onCopy()}
            className="rounded-full border border-zinc-300 px-3 py-1 text-[11px] font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={basescanAddressUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-zinc-700 underline dark:text-zinc-300"
          >
            BaseScan
          </a>
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Not set</p>
      )}
    </div>
  );
}
