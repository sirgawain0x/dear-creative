"use client";

import { useMemo } from "react";
import makeBlockie from "ethereum-blockies-base64";
import { cn } from "@/lib/utils/cn";
import { shortenAddress } from "@/lib/wallet/short-address";

const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000";

type ReaderAccountTriggerProps = {
  address: string | null;
  loading?: boolean;
  /** When false, render identicon-only (narrow header slots). */
  showAddress?: boolean;
  className?: string;
  "data-testid"?: string;
};

export function ReaderAccountTrigger({
  address,
  loading = false,
  showAddress = true,
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
        "inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-300 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900",
        showAddress ? "px-2.5 py-1.5" : "p-1.5",
        className,
      )}
      data-testid={testId}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={blockieSrc}
        alt=""
        aria-hidden
        className="h-5 w-5 shrink-0 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700"
        width={20}
        height={20}
      />
      {showAddress ? (
        <span className="max-w-[5.5rem] truncate font-mono tabular-nums min-[841px]:max-w-[7rem] lg:max-w-none">
          {label}
        </span>
      ) : null}
    </span>
  );
}
