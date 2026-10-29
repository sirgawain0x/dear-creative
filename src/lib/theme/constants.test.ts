/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  readStoredThemePreference,
  writeStoredThemePreference,
} from "./constants";

describe("theme persistence", () => {
  afterEach(() => {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it("uses the next-themes storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("theme");
  });

  it("round-trips light and dark preferences in localStorage", () => {
    writeStoredThemePreference("light");
    expect(readStoredThemePreference()).toBe("light");

    writeStoredThemePreference("dark");
    expect(readStoredThemePreference()).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
