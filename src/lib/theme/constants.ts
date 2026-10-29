/** Matches `next-themes` default localStorage key. */
export const THEME_STORAGE_KEY = "theme";

export type StoredThemePreference = "light" | "dark" | "system";

export function readStoredThemePreference(): StoredThemePreference | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return null;
}

export function writeStoredThemePreference(value: StoredThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(THEME_STORAGE_KEY, value);
}
