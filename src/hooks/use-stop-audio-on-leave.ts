"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Stops audio/TTS when the component unmounts, the App Router pathname changes,
 * or the browser fires `pagehide` (navigation away / bfcache).
 */
export function useStopAudioOnLeave(stop: () => void): void {
  const stopRef = useRef(stop);

  useEffect(() => {
    stopRef.current = stop;
  });

  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    const handlePageHide = () => {
      stopRef.current();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", handlePageHide);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", handlePageHide);
      }
      stopRef.current();
    };
  }, []);

  useEffect(() => {
    if (pathnameRef.current !== pathname) {
      pathnameRef.current = pathname;
      stopRef.current();
    }
  }, [pathname]);
}
