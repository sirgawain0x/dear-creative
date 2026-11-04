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

const MOBILE_HISTORY_MQ = "(max-width: 767px)";

export function stubMatchMedia(options?: { mobile?: boolean }) {
  const mobile = options?.mobile ?? false;
  const mock = vi.fn((query: string) =>
    createMatchMedia(query, query === MOBILE_HISTORY_MQ ? mobile : false),
  );
  vi.stubGlobal("matchMedia", mock);
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mock,
    });
  }
  return mock;
}
