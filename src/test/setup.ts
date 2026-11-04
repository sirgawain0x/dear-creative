import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { createMatchMedia } from "./match-media";

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => createMatchMedia(query, false),
  });
}

/** Unmount RTL trees before jsdom teardown so React scheduler does not run without `window`. */
afterEach(() => {
  if (typeof document !== "undefined") {
    cleanup();
  }
});
