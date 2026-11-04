import "@testing-library/jest-dom/vitest";
import { createMatchMedia } from "./match-media";

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => createMatchMedia(query, false),
  });
}
