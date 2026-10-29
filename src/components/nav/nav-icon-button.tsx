import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type NavIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Outline icon control — matches crtv3 `navIconButtonProps` sizing. */
export function NavIconButton({ className, type = "button", ...props }: NavIconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-transparent text-zinc-700 shadow-xs transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 dark:focus-visible:ring-zinc-600 dark:focus-visible:ring-offset-zinc-950",
        className,
      )}
      {...props}
    />
  );
}
