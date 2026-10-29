"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type MouseEvent } from "react";
import { HOME_SUBSCRIBE_SECTION_ID } from "@/components/home/home-subscribe-cta";
import { useAuthSession } from "./providers/app-providers";
import { CreativePlatformAppsDrawer } from "./creative-platform/creative-platform-apps-drawer";
import { ThemeToggle } from "./theme/theme-toggle";
import { ReaderAccountDropdown } from "./wallet/reader-account-dropdown";
import type { ReaderWalletPreviewData } from "./wallet/reader-wallet-panel";

export const SUBSCRIBE_NAV_HREF = "/#subscribe";

export type SiteNavLink = {
  href: string;
  label: string;
  matchPrefix?: boolean;
  requiresAuth?: boolean;
  /** Nav item scrolls to the homepage subscribe card (`/#subscribe`). */
  homeSubscribeAnchor?: boolean;
};

export const SITE_NAV_LINKS: readonly SiteNavLink[] = [
  { href: "/", label: "Home", matchPrefix: false },
  { href: "/posts", label: "Posts", matchPrefix: true },
  {
    href: SUBSCRIBE_NAV_HREF,
    label: "Subscribe",
    homeSubscribeAnchor: true,
  },
  { href: "/adam", label: "Studio", matchPrefix: true, requiresAuth: true },
  { href: "/admin", label: "Sign In", matchPrefix: true },
] as const;

export function getSubscribeNavHref(pathname: string | null): string {
  return pathname === "/" ? "#subscribe" : SUBSCRIBE_NAV_HREF;
}

export function isNavLinkActive(pathname: string | null, link: SiteNavLink): boolean {
  if (!pathname) return false;
  if (link.homeSubscribeAnchor) {
    return pathname === "/subscribe" || pathname.startsWith("/subscribe/");
  }
  if (!link.matchPrefix || link.href === "/") {
    return pathname === link.href;
  }
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

function scrollToHomeSubscribeCard(): void {
  document.getElementById(HOME_SUBSCRIBE_SECTION_ID)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  window.history.replaceState(null, "", "#subscribe");
}

export function onSubscribeNavClick(
  pathname: string | null,
  afterNavigate?: () => void,
): (event: MouseEvent<HTMLAnchorElement>) => void {
  if (pathname !== "/") {
    return () => {
      afterNavigate?.();
    };
  }
  return (event) => {
    event.preventDefault();
    scrollToHomeSubscribeCard();
    afterNavigate?.();
  };
}

export function getVisibleNavLinks(isSignedIn: boolean): readonly SiteNavLink[] {
  return SITE_NAV_LINKS.filter((link) => {
    if (link.requiresAuth && !isSignedIn) {
      return false;
    }
    return true;
  });
}

export type SiteHeaderProps = {
  readerWalletEnabled?: boolean;
  /** Dev fixture pages — simulates signed-in reader wallet in the real header chrome. */
  fixtureAuthenticated?: boolean;
  fixturePreviewData?: ReaderWalletPreviewData;
  fixtureShowAdmin?: boolean;
};

export function SiteHeader({
  readerWalletEnabled = false,
  fixtureAuthenticated = false,
  fixturePreviewData,
  fixtureShowAdmin = false,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuId = useId();
  const {
    isSignedIn,
    signOut,
    login,
    privyConfigured,
    privyTimedOut,
  } = useAuthSession();
  const showReaderWalletButton = readerWalletEnabled || fixtureAuthenticated;
  const readerDropdownFixture = fixtureAuthenticated
    ? {
        fixtureAuthenticated: true as const,
        fixturePreviewData,
        fixtureShowAdmin,
      }
    : {};

  const visibleLinks = getVisibleNavLinks(isSignedIn);
  const hideNavSignInForReaderWallet =
    showReaderWalletButton && !isSignedIn && !fixtureAuthenticated;

  return (
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="flex min-w-0 shrink items-center gap-2.5 text-lg font-semibold tracking-tight text-zinc-900 hover:opacity-80 dark:text-zinc-50"
            >
              <img
                src="/images/dear-creative-logo.png"
                alt="Dear Creative Logo"
                className="h-8 w-8 shrink-0 rounded-full border border-zinc-200/80 object-cover shadow-2xs dark:border-zinc-800"
              />
              <span className="whitespace-nowrap">Dear Creative</span>
            </Link>
            <span className="hidden rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 sm:inline-block dark:bg-zinc-900 dark:text-zinc-400">
              Creative Platform
            </span>
          </div>

          {/* Desktop navigation */}
          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {visibleLinks.map((link) => {
              const active = isNavLinkActive(pathname, link);
              const isAuthAction = link.href === "/admin";
              const label = isAuthAction && isSignedIn ? "Sign Out" : link.label;

              if (isAuthAction && hideNavSignInForReaderWallet) {
                return null;
              }

              // Don't render standalone Sign Out in nav when reader wallet is shown
              // (the wallet dropdown already contains Sign Out)
              if (isAuthAction && isSignedIn && showReaderWalletButton) {
                return null;
              }

              if (isAuthAction && isSignedIn) {
                return (
                  <button
                    key={`${link.href}-sign-out`}
                    type="button"
                    onClick={() => void signOut()}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 hover:text-red-600 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-red-400"
                    title="Sign Out"
                  >
                    Sign Out
                  </button>
                );
              }

              if (isAuthAction && !isSignedIn && privyConfigured && !privyTimedOut) {
                return (
                  <button
                    key={link.href}
                    type="button"
                    onClick={login}
                    disabled={privyTimedOut}
                    className="rounded-full border border-zinc-300 bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white shadow-2xs transition-colors hover:bg-zinc-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {label}
                  </button>
                );
              }

              const href = link.homeSubscribeAnchor
                ? getSubscribeNavHref(pathname)
                : link.href;

              return (
                <Link
                  key={link.href}
                  href={href}
                  onClick={
                    link.homeSubscribeAnchor
                      ? onSubscribeNavClick(pathname)
                      : undefined
                  }
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : isAuthAction
                      ? "border border-zinc-300 bg-zinc-900 text-white shadow-2xs hover:bg-zinc-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            {showReaderWalletButton ? (
              <ReaderAccountDropdown
                surface="desktop"
                className="ml-0.5"
                {...readerDropdownFixture}
              />
            ) : null}
            <a
              href={process.env.NEXT_PUBLIC_X_URL || "https://x.com/CreativeCrtv"}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              title="Creative on 𝕏 (@CreativeCrtv)"
              aria-label="Creative on 𝕏 (@CreativeCrtv)"
            >
              <span className="text-xs font-bold">𝕏</span>
            </a>
          </nav>

        <div className="flex items-center gap-2">
          {/* Mobile: ReaderAccountDropdown removed from top bar — Sign In lives in hamburger menu */}
          <CreativePlatformAppsDrawer />
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileMenuId}
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 lg:hidden dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {mobileMenuOpen ? "Close ✕" : "Menu ☰"}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen ? (
        <nav
          id={mobileMenuId}
          aria-label="Mobile navigation"
          className="border-t border-zinc-200 bg-white px-6 py-3 lg:hidden dark:border-zinc-800 dark:bg-zinc-950"
        >
          <ul className="flex flex-col gap-1">
            {visibleLinks.map((link) => {
              const active = isNavLinkActive(pathname, link);
              const isAuthAction = link.href === "/admin";
              const label = isAuthAction && isSignedIn ? "Sign Out" : link.label;

              if (isAuthAction && hideNavSignInForReaderWallet) {
                return null;
              }

              if (isAuthAction && isSignedIn) {
                return (
                  <li key={`${link.href}-sign-out`}>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        void signOut();
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      Sign Out
                    </button>
                  </li>
                );
              }

              if (isAuthAction && !isSignedIn && privyConfigured && !privyTimedOut) {
                return (
                  <li key={link.href}>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        login();
                      }}
                      disabled={privyTimedOut}
                      className="block w-full rounded-lg bg-zinc-900 px-3 py-2 text-left text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {label}
                    </button>
                  </li>
                );
              }

              const href = link.homeSubscribeAnchor
                ? getSubscribeNavHref(pathname)
                : link.href;

              return (
                <li key={link.href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={
                      link.homeSubscribeAnchor
                        ? onSubscribeNavClick(pathname, () =>
                            setMobileMenuOpen(false),
                          )
                        : () => setMobileMenuOpen(false)
                    }
                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
            <li className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <a
                href={process.env.NEXT_PUBLIC_X_URL || "https://x.com/CreativeCrtv"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                aria-label="Creative on 𝕏 (@CreativeCrtv)"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-xs text-white dark:bg-white dark:text-zinc-900">
                  𝕏
                </span>
                <span>Follow on 𝕏 (@CreativeCrtv)</span>
              </a>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
