"use client";

import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { NavIconButton } from "@/components/nav/nav-icon-button";

function subscribeNoop() {
  return () => {};
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  if (!mounted) {
    return (
      <NavIconButton
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none opacity-0"
        data-testid="theme-toggle-placeholder"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <NavIconButton
      data-testid="theme-toggle"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <SunIcon className="h-[1.2rem] w-[1.2rem]" aria-hidden />
      ) : (
        <MoonIcon className="h-[1.2rem] w-[1.2rem]" aria-hidden />
      )}
      <span className="sr-only">Toggle theme</span>
    </NavIconButton>
  );
}
