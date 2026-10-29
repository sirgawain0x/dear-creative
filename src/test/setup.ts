import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/** Full MediaQueryList stub for next-themes and matchMedia consumers in jsdom. */
export function createMatchMedia(query: string, matches = false) {
  return {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => createMatchMedia(query, false),
  });
}
