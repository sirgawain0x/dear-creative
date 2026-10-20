"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  buildPostShareMenuItems,
  triggerPostShare,
  type ShareMenuItem,
} from "@/lib/posts/post-share-urls";
import { useToast } from "@/components/ui/toast";

type PostShareButtonProps = {
  title: string;
  url: string;
};

function focusMenuItem(
  container: HTMLElement | null,
  index: number,
  items: ShareMenuItem[],
) {
  if (!container || items.length === 0) return;
  const clamped = ((index % items.length) + items.length) % items.length;
  const buttons = container.querySelectorAll<HTMLElement>(
    '[role="menuitem"]',
  );
  buttons[clamped]?.focus();
}

export function PostShareButton({ title, url }: PostShareButtonProps) {
  const menuId = useId();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const items = buildPostShareMenuItems({ title, url });

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen, closeMenu]);

  const openMenu = useCallback(() => {
    setMenuOpen(true);
    setFocusedIndex(0);
    requestAnimationFrame(() => {
      focusMenuItem(menuRef.current, 0, items);
    });
  }, [items]);

  const handlePrimaryClick = async () => {
    if (menuOpen) {
      closeMenu();
      return;
    }

    try {
      await triggerPostShare(
        {
          title,
          url,
          onFallback: openMenu,
        },
        typeof navigator !== "undefined" ? navigator : undefined,
      );
    } catch {
      openMenu();
    }
  };

  const handleCopy = async (linkUrl: string) => {
    try {
      await navigator.clipboard.writeText(linkUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
    closeMenu();
  };

  const onButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" && !menuOpen) {
      event.preventDefault();
      openMenu();
    }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        closeMenu();
        break;
      case "ArrowDown":
        event.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev + 1;
          focusMenuItem(menuRef.current, next, items);
          return next;
        });
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev - 1;
          focusMenuItem(menuRef.current, next, items);
          return next;
        });
        break;
      case "Home":
        event.preventDefault();
        setFocusedIndex(0);
        focusMenuItem(menuRef.current, 0, items);
        break;
      case "End":
        event.preventDefault();
        setFocusedIndex(items.length - 1);
        focusMenuItem(menuRef.current, items.length - 1, items);
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Share ${title}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => {
          void handlePrimaryClick();
        }}
        onKeyDown={onButtonKeyDown}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-xs transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
      >
        <svg
          aria-hidden
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.59 13.51l6.83 3.98" />
          <path d="M15.41 6.51l-6.82 3.98" />
        </svg>
      </button>

      {menuOpen ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Share post"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-40 mt-2 min-w-[11rem] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {items.map((item, index) =>
            item.kind === "copy" ? (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                tabIndex={index === focusedIndex ? 0 : -1}
                className="flex w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
                onClick={() => {
                  void handleCopy(item.url);
                }}
              >
                {item.label}
              </button>
            ) : (
              <a
                key={item.id}
                role="menuitem"
                tabIndex={index === focusedIndex ? 0 : -1}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
                onClick={() => closeMenu()}
              >
                {item.label}
              </a>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
