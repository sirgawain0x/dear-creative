"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { scrollHomeSubscribeIntoView } from "@/components/home/scroll-home-subscribe-into-view";

export function HomeSubscribeHashScroll() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (pathname !== "/") {
      return;
    }
    if (window.location.hash !== "#subscribe") {
      return;
    }
    scrollHomeSubscribeIntoView("instant");
    requestAnimationFrame(() => {
      scrollHomeSubscribeIntoView("smooth");
    });
  }, [pathname]);

  return null;
}
