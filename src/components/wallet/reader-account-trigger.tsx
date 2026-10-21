"use client";

import { useMemo } from "react";
import makeBlockie from "ethereum-blockies-base64";
import { cn } from "@/lib/utils/cn";
import { shortenAddress } from "@/lib/wallet/short-address";

const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000";

type ReaderAccountTriggerProps = {
  address: string | null;
  loading?: boolean;
  className?: string;
  "data-testid"?: string;
};

export function ReaderAccountTrigger({
  address,
  loading = false,
  className,
  "data-testid": testId,
}: ReaderAccountTriggerProps) {
  const blockieSrc = useMemo(
    () => makeBlockie(address ?? PLACEHOLDER_ADDRESS),
    [address],
  );

  const label = address
    ? shortenAddress(address)
    : loading
      ? "Loading…"
      : "Account";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900",
        className,
      )}
      data-testid={testId}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={blockieSrc}
        alt=""
        aria-hidden
        className="h-5 w-5 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700"
        width={20}
        height={20}
      />
      <span className="font-mono tabular-nums">{label}</span>
    </span>
  );
}
