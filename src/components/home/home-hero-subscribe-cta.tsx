"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSubscribeNavHref, onSubscribeNavClick } from "@/components/site-header";

export function HomeHeroSubscribeCta() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={getSubscribeNavHref(pathname)}
        onClick={onSubscribeNavClick(pathname)}
        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Subscribe Free
      </Link>
    </div>
  );
}
