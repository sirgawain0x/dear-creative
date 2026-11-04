/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdamChatThreadHistory } from "./adam-chat-thread-history";

const threads = [
  { id: "thread_a", title: "Alpha chat", updatedAt: 3 },
  { id: "thread_b", title: "Beta chat", updatedAt: 2 },
];

function renderHistory(
  overrides?: Partial<Parameters<typeof AdamChatThreadHistory>[0]>,
) {
  const onSelectThread = vi.fn();
  const onSaveRename = vi.fn();
  const onDeleteThread = vi.fn();
  const onCancelRename = vi.fn();

  render(
    <AdamChatThreadHistory
      chatThreads={threads}
      activeThreadId="thread_a"
      editingThreadId={null}
      editingThreadTitle=""
      onNewChat={vi.fn()}
      onSelectThread={onSelectThread}
      onStartRename={vi.fn()}
      onEditingTitleChange={vi.fn()}
      onSaveRename={onSaveRename}
      onCancelRename={onCancelRename}
      onDeleteThread={onDeleteThread}
      initialHistoryOpen
      {...overrides}
    />,
  );

  return { onSelectThread, onSaveRename, onDeleteThread, onCancelRename };
}

function stubDesktopViewport() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 767px)" ? false : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("AdamChatThreadHistory", () => {
  beforeEach(() => {
    stubDesktopViewport();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not render a horizontally scrollable tab row", () => {
    renderHistory();
    const root = screen.getByTestId("adam-chat-thread-history");
    expect(root.querySelector(".overflow-x-auto")).toBeNull();
  });

  it("opens desktop popover and selects a thread", () => {
    const { onSelectThread } = renderHistory();
    const list = screen.getByTestId("adam-chat-thread-history-list");
    fireEvent.click(within(list).getByRole("button", { name: "Beta chat" }));
    expect(onSelectThread).toHaveBeenCalledWith("thread_b");
  });

  it("starts rename from the history list", () => {
    const onStartRename = vi.fn();
    renderHistory({ onStartRename });

    fireEvent.click(
      screen.getByRole("button", { name: "Rename Beta chat" }),
    );
    expect(onStartRename).toHaveBeenCalledWith("thread_b", "Beta chat");
  });

  it("confirms delete from the history list", () => {
    const { onDeleteThread } = renderHistory();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Beta chat" }),
    );
    expect(
      screen.getByTestId("adam-chat-thread-delete-confirm-thread_b"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteThread).toHaveBeenCalledWith("thread_b");
  });

  it("Escape in rename input cancels edit without closing desktop popover", () => {
    const onCancelRename = vi.fn();
    renderHistory({
      editingThreadId: "thread_b",
      editingThreadTitle: "Beta chat",
      onCancelRename,
    });
    fireEvent.keyDown(screen.getByLabelText("Conversation title"), {
      key: "Escape",
      code: "Escape",
    });
    expect(onCancelRename).toHaveBeenCalled();
    expect(screen.getByTestId("adam-chat-thread-history-popover")).toBeInTheDocument();
  });

  it("focuses the mobile history dialog when opened", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    renderHistory({ initialHistoryOpen: true });
    await waitFor(() => {
      expect(screen.getByLabelText("Close history")).toHaveFocus();
    });
  });

  it("uses modal layout on narrow viewports", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    renderHistory({ initialHistoryOpen: false });
    fireEvent.click(screen.getByTestId("adam-chat-thread-history-trigger"));
    expect(screen.getByTestId("adam-chat-thread-history-modal")).toBeTruthy();
  });
});
