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
import { stubMatchMedia } from "@/test/match-media";
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

describe("AdamChatThreadHistory", () => {
  beforeEach(() => {
    stubMatchMedia({ mobile: false });
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
    fireEvent.click(screen.getByTestId("adam-chat-thread-select-thread_b"));
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
    const confirmPanel = screen.getByTestId(
      "adam-chat-thread-delete-confirm-thread_b",
    );
    fireEvent.click(
      within(confirmPanel).getByRole("button", { name: "Delete" }),
    );
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

  it("does not steal focus from rename input when mobile edit starts", async () => {
    vi.unstubAllGlobals();
    stubMatchMedia({ mobile: true });

    const baseProps = {
      chatThreads: threads,
      activeThreadId: "thread_a" as const,
      editingThreadId: null as string | null,
      editingThreadTitle: "",
      onNewChat: vi.fn(),
      onSelectThread: vi.fn(),
      onStartRename: vi.fn(),
      onEditingTitleChange: vi.fn(),
      onSaveRename: vi.fn(),
      onCancelRename: vi.fn(),
      onDeleteThread: vi.fn(),
      initialHistoryOpen: true,
    };

    const { rerender } = render(<AdamChatThreadHistory {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByLabelText("Close history")).toHaveFocus();
    });

    rerender(
      <AdamChatThreadHistory
        {...baseProps}
        editingThreadId="thread_b"
        editingThreadTitle="Beta chat"
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Conversation title")).toHaveFocus();
    });
  });

  it("focuses the mobile history dialog when opened", async () => {
    vi.unstubAllGlobals();
    stubMatchMedia({ mobile: true });

    renderHistory({ initialHistoryOpen: true });
    await waitFor(() => {
      expect(screen.getByLabelText("Close history")).toHaveFocus();
    });
  });

  it("uses modal layout on narrow viewports", () => {
    vi.unstubAllGlobals();
    stubMatchMedia({ mobile: true });

    renderHistory({ initialHistoryOpen: false });
    fireEvent.click(screen.getByTestId("adam-chat-thread-history-trigger"));
    expect(screen.getByTestId("adam-chat-thread-history-modal")).toBeTruthy();
  });
});
