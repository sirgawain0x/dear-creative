"use client";

import { useEffect } from "react";
import { persistSignupSrcFromSearch } from "@/lib/subscribers/signup-src-session";

/** Captures `?src=` on landing and stores it for the subscribe form. */
export function CaptureSignupSrc() {
  useEffect(() => {
    persistSignupSrcFromSearch(window.location.search);
  }, []);

  return null;
}
