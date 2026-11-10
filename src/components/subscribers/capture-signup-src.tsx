"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { persistSignupSrcFromSearch } from "@/lib/subscribers/signup-src-session";

/** Captures `?src=` on landing and client navigations; stores for the subscribe form. */
export function CaptureSignupSrc() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const query = searchParams.toString();
    persistSignupSrcFromSearch(query ? `?${query}` : "");
  }, [pathname, searchParams]);

  return null;
}
