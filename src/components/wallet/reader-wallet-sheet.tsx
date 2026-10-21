"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ReaderWalletPanel } from "./reader-wallet-panel";

type ReaderWalletSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReaderWalletSheet({ open, onOpenChange }: ReaderWalletSheetProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end"
      data-testid="reader-wallet-sheet-overlay"
    >
      <button
        type="button"
        aria-label="Close wallet panel"
        className="absolute inset-0 bg-zinc-900/40"
        onClick={() => onOpenChange(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        data-testid="reader-wallet-sheet"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 id={titleId} className="text-sm font-semibold">
            Wallet
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ReaderWalletPanel />
        </div>
      </aside>
    </div>,
    document.body,
  );
}
