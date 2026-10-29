"use client";

import Link from "next/link";
import {
  LayoutGrid,
  Newspaper,
  BookOpen,
  Tv,
  Bot,
  Landmark,
  Disc3,
  Gamepad2,
  Mic,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import {
  CREATIVE_PLATFORM_APP_DEFINITIONS,
  isCreativePlatformCurrentApp,
  type CreativePlatformAppName,
} from "@/lib/creative-platform/apps";
import { cn } from "@/lib/utils/cn";
import { NavIconButton } from "@/components/nav/nav-icon-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const APP_ICONS: Record<CreativePlatformAppName, LucideIcon> = {
  News: Newspaper,
  Books: BookOpen,
  TV: Tv,
  Pixels: Bot,
  Finance: Landmark,
  Mixtape: Disc3,
  "Beat Me": Gamepad2,
  Podcast: Mic,
};

export function CreativePlatformAppsDrawer() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <NavIconButton id="creative-platform-apps-btn">
          <LayoutGrid className="h-[1.2rem] w-[1.2rem]" aria-hidden />
          <span className="sr-only">Browse Creative Platform apps</span>
        </NavIconButton>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-sm"
        data-testid="creative-platform-apps-sheet"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Creative Platform</SheetTitle>
          <SheetDescription>
            Explore apps across the Creative Platform ecosystem.
          </SheetDescription>
        </SheetHeader>
        <nav className="mt-6 grid gap-2" aria-label="Creative Platform apps">
          {CREATIVE_PLATFORM_APP_DEFINITIONS.map((app) => {
            const Icon = APP_ICONS[app.name];
            const isExternal = app.href.startsWith("http");
            const isCurrent = isCreativePlatformCurrentApp(app.name);

            return (
              <Link
                key={app.name}
                href={app.href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border border-transparent p-3",
                  "transition-colors hover:border-zinc-200 hover:bg-zinc-50",
                  "dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50",
                  isCurrent &&
                    "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                    "group-hover:bg-white dark:group-hover:bg-zinc-900",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{app.name}</span>
                    {isCurrent ? (
                      <span
                        className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-500"
                        data-testid="creative-platform-current-badge"
                      >
                        Current
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {app.description}
                  </span>
                </span>
                {isExternal ? (
                  <ExternalLink
                    className="h-4 w-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500"
                    aria-hidden
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
