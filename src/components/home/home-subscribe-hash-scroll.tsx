"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { HOME_SUBSCRIBE_SECTION_ID } from "@/components/home/home-subscribe-cta";

export function HomeSubscribeHashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") {
      return;
    }
    if (window.location.hash !== "#subscribe") {
      return;
    }
    // Native hash + scrollIntoView honor #subscribe scroll-margin-top (globals.css).
    const target = document.getElementById(HOME_SUBSCRIBE_SECTION_ID);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pathname]);

  return null;
}
