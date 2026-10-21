"use client";

import { usePathname } from "next/navigation";
import { SiteHeader, type SiteHeaderProps } from "./site-header";

const FIXTURE_PATH_PREFIXES = [
  "/reader/account-dropdown-fixture",
  "/reader/site-header-fixture",
] as const;

function isFixturePath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }
  return FIXTURE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function SiteHeaderShell(props: SiteHeaderProps) {
  const pathname = usePathname();
  if (isFixturePath(pathname)) {
    return null;
  }
  return <SiteHeader {...props} />;
}
