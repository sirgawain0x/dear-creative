"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { getFocusableElements } from "@/lib/a11y/focusable-elements";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type AdamChatThreadSummary = {
  id: string;
  title: string;
  updatedAt?: number;
};

const MOBILE_HISTORY_MQ = "(max-width: 767px)";

function useMobileHistoryLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(MOBILE_HISTORY_MQ);
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

type ThreadHistoryListProps = {
  chatThreads: AdamChatThreadSummary[];
  activeThreadId: string | null;
  editingThreadId: string | null;
  editingThreadTitle: string;
  pendingDeleteId: string | null;
  onSelectThread: (threadId: string) => void;
  onStartRename: (threadId: string, title: string) => void;
  onEditingTitleChange: (title: string) => void;
  onSaveRename: (threadId: string, title: string) => void;
  onCancelRename: () => void;
  onRequestDelete: (threadId: string) => void;
  onConfirmDelete: (threadId: string) => void;
  onCancelDelete: () => void;
};

function AdamChatThreadHistoryList({
  chatThreads,
  activeThreadId,
  editingThreadId,
  editingThreadTitle,
  pendingDeleteId,
  onSelectThread,
  onStartRename,
  onEditingTitleChange,
  onSaveRename,
  onCancelRename,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: ThreadHistoryListProps) {
  const handleRenameKeyDown = (
    threadId: string,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      void onSaveRename(threadId, editingThreadTitle);
    } else if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      onCancelRename();
    }
  };

  if (chatThreads.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No saved conversations yet.
      </p>
    );
  }

  return (
    <ul
      className="max-h-[min(420px,60vh)] overflow-y-auto overflow-x-hidden py-1"
      data-testid="adam-chat-thread-history-list"
    >
      {chatThreads.map((thread) => {
        const isActive = activeThreadId === thread.id;
        const isEditing = editingThreadId === thread.id;
        const isConfirmingDelete = pendingDeleteId === thread.id;

        if (isConfirmingDelete) {
          return (
            <li
              key={thread.id}
              className="mx-1 my-0.5 rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 dark:border-rose-900/60 dark:bg-rose-950/40"
              data-testid={`adam-chat-thread-delete-confirm-${thread.id}`}
            >
              <p className="text-xs font-medium text-rose-900 dark:text-rose-100">
                Delete &ldquo;{thread.title}&rdquo;?
              </p>
              <p className="mt-0.5 text-[11px] text-rose-800/80 dark:text-rose-200/80">
                This cannot be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                  onClick={() => onConfirmDelete(thread.id)}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={onCancelDelete}
                >
                  Cancel
                </button>
              </div>
            </li>
          );
        }

        if (isEditing) {
          return (
            <li
              key={thread.id}
              className="mx-1 my-0.5 rounded-lg border border-amber-500 bg-amber-50/50 px-2 py-1.5 dark:bg-amber-950/30"
              data-testid={`adam-chat-thread-rename-${thread.id}`}
            >
              <input
                type="text"
                value={editingThreadTitle}
                onChange={(e) => onEditingTitleChange(e.target.value)}
                onKeyDown={(e) => handleRenameKeyDown(thread.id, e)}
                className="w-full bg-transparent text-sm font-medium text-zinc-900 outline-hidden dark:text-zinc-100"
                autoFocus
                aria-label="Conversation title"
              />
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => onSaveRename(thread.id, editingThreadTitle)}
                  className="text-[11px] font-semibold text-amber-700 hover:underline dark:text-amber-400"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelRename}
                  className="text-[11px] text-zinc-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </li>
          );
        }

        return (
          <li
            key={thread.id}
            className={`group mx-1 my-0.5 flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectThread(thread.id)}
              className="min-w-0 flex-1 truncate text-left font-medium"
              title={thread.title}
              data-testid={`adam-chat-thread-select-${thread.id}`}
            >
              {thread.title}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartRename(thread.id, thread.title);
              }}
              className={`shrink-0 rounded p-1 opacity-70 transition hover:opacity-100 ${
                isActive
                  ? "hover:text-amber-300 dark:hover:text-amber-700"
                  : "hover:text-amber-600 dark:hover:text-amber-400"
              }`}
              title="Rename conversation"
              aria-label={`Rename ${thread.title}`}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete(thread.id);
              }}
              className={`shrink-0 rounded p-1 opacity-70 transition hover:opacity-100 hover:text-rose-500 ${
                isActive ? "dark:hover:text-rose-600" : ""
              }`}
              title="Delete conversation"
              aria-label={`Delete ${thread.title}`}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type AdamChatThreadHistoryProps = {
  chatThreads: AdamChatThreadSummary[];
  activeThreadId: string | null;
  editingThreadId: string | null;
  editingThreadTitle: string;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onStartRename: (threadId: string, title: string) => void;
  onEditingTitleChange: (title: string) => void;
  onSaveRename: (threadId: string, title: string) => void | Promise<void>;
  onCancelRename: () => void;
  onDeleteThread: (threadId: string) => void | Promise<void>;
  /** @internal test hook */
  initialHistoryOpen?: boolean;
};

export function AdamChatThreadHistory({
  chatThreads,
  activeThreadId,
  editingThreadId,
  editingThreadTitle,
  onNewChat,
  onSelectThread,
  onStartRename,
  onEditingTitleChange,
  onSaveRename,
  onCancelRename,
  onDeleteThread,
  initialHistoryOpen = false,
}: AdamChatThreadHistoryProps) {
  const titleId = useId();
  const isMobile = useMobileHistoryLayout();
  const [menuOpen, setMenuOpen] = useState(initialHistoryOpen);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mobileDialogPanelRef = useRef<HTMLDivElement>(null);
  const editingThreadIdRef = useRef(editingThreadId);
  const pendingDeleteIdRef = useRef(pendingDeleteId);
  const closeMenuRef = useRef<() => void>(() => {});

  const focusHistoryTrigger = useCallback(() => {
    triggerRef.current?.focus();
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setPendingDeleteId(null);
    onCancelRename();
    focusHistoryTrigger();
  }, [onCancelRename, focusHistoryTrigger]);

  useEffect(() => {
    editingThreadIdRef.current = editingThreadId;
    pendingDeleteIdRef.current = pendingDeleteId;
    closeMenuRef.current = closeMenu;
  }, [editingThreadId, pendingDeleteId, closeMenu]);

  useEffect(() => {
    if (!isMobile || !menuOpen || editingThreadId || pendingDeleteId) {
      return undefined;
    }
    const panel = mobileDialogPanelRef.current;
    if (!panel) {
      return undefined;
    }

    const focusables = getFocusableElements(panel);
    const preferred =
      panel.querySelector<HTMLElement>("[data-autofocus-history]") ??
      focusables[0];
    preferred?.focus();
  }, [isMobile, menuOpen, editingThreadId, pendingDeleteId]);

  useEffect(() => {
    if (!isMobile || !menuOpen) {
      return undefined;
    }
    const panel = mobileDialogPanelRef.current;
    if (!panel) {
      return undefined;
    }

    function handleDialogKeyDown(event: globalThis.KeyboardEvent) {
      const focusables = getFocusableElements(panel);
      if (event.key === "Tab" && focusables.length > 0) {
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (
        event.key === "Escape" &&
        !editingThreadIdRef.current &&
        !pendingDeleteIdRef.current
      ) {
        event.preventDefault();
        closeMenuRef.current();
      }
    }

    panel.addEventListener("keydown", handleDialogKeyDown);
    return () => panel.removeEventListener("keydown", handleDialogKeyDown);
  }, [isMobile, menuOpen]);

  const handleSelectThread = useCallback(
    async (threadId: string) => {
      closeMenu();
      await onSelectThread(threadId);
    },
    [closeMenu, onSelectThread],
  );

  const handleConfirmDelete = useCallback(
    async (threadId: string) => {
      setPendingDeleteId(null);
      closeMenu();
      await onDeleteThread(threadId);
    },
    [closeMenu, onDeleteThread],
  );

  const listProps: ThreadHistoryListProps = {
    chatThreads,
    activeThreadId,
    editingThreadId,
    editingThreadTitle,
    pendingDeleteId,
    onSelectThread: (threadId) => void handleSelectThread(threadId),
    onStartRename,
    onEditingTitleChange,
    onSaveRename: (threadId, title) => void onSaveRename(threadId, title),
    onCancelRename,
    onRequestDelete: setPendingDeleteId,
    onConfirmDelete: (threadId) => void handleConfirmDelete(threadId),
    onCancelDelete: () => setPendingDeleteId(null),
  };

  const historyTrigger = (
    <button
      type="button"
      className="inline-flex items-center justify-center rounded-lg border border-zinc-200 p-2 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      aria-label="Conversation history"
      aria-expanded={menuOpen}
      aria-haspopup="dialog"
      data-testid="adam-chat-thread-history-trigger"
      ref={triggerRef}
      onClick={() => {
        if (isMobile) {
          setMenuOpen(true);
        }
      }}
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l4 2" />
      </svg>
      {chatThreads.length > 0 ? (
        <span className="sr-only">{chatThreads.length} saved conversations</span>
      ) : null}
    </button>
  );

  return (
    <div
      className="flex min-w-0 shrink items-center gap-2"
      data-testid="adam-chat-thread-history"
    >
      <button
        type="button"
        onClick={onNewChat}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
          activeThreadId === null
            ? "bg-zinc-900 text-white shadow-2xs dark:bg-zinc-100 dark:text-zinc-900"
            : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Start a fresh conversation thread"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>New Chat</span>
      </button>

      {isMobile ? (
        <>
          {historyTrigger}
          {menuOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              data-testid="adam-chat-thread-history-modal"
              onClick={closeMenu}
            >
              <div
                ref={mobileDialogPanelRef}
                tabIndex={-1}
                className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-xl outline-hidden sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-950"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <h2 id={titleId} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Conversation history
                  </h2>
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    aria-label="Close history"
                    data-autofocus-history
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <AdamChatThreadHistoryList {...listProps} />
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open);
            if (!open) {
              setPendingDeleteId(null);
              onCancelRename();
            }
          }}
        >
          <DropdownMenuTrigger asChild>{historyTrigger}</DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[min(320px,calc(100vw-2rem))] p-0"
            data-testid="adam-chat-thread-history-popover"
            onEscapeKeyDown={(event) => {
              if (editingThreadId || pendingDeleteId) {
                event.preventDefault();
              }
            }}
          >
            <p className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Conversation history
            </p>
            <AdamChatThreadHistoryList {...listProps} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
