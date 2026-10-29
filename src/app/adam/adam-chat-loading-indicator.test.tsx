/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdamStudio } from "./adam-studio";
import {
  AppProviders,
  STUDIO_TOKEN_STORAGE_KEY,
} from "@/components/providers/app-providers";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/adam",
}));

vi.mock("@/components/providers/app-providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/providers/app-providers")>();
  return {
    ...actual,
    useSafePrivy: () => ({
      ready: true,
      authenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn(async () => null),
      privyConfigured: true,
      adamTokenConfigured: true,
      configLoaded: true,
      privyTimedOut: false,
    }),
  };
});

const FIXTURE_THREADS = [
  {
    id: "thread_fixture_a",
    title: "Thread A",
    updatedAt: "2026-01-01T12:00:00.000Z",
    createdAt: "2026-01-01T12:00:00.000Z",
  },
  {
    id: "thread_fixture_b",
    title: "Thread B",
    updatedAt: "2026-01-02T12:00:00.000Z",
    createdAt: "2026-01-02T12:00:00.000Z",
  },
];

function mockStudioFetch(options?: {
  chatHandler?: (init: RequestInit) => Response | Promise<Response>;
  /** Delays every chat threads list response until the promise settles. */
  delayThreadsListUntil?: Promise<void>;
  /** Awaits `gate` before responding on the Nth chat threads list fetch (1-based). */
  blockThreadsListOnFetch?: {
    fetchNumber: number;
    gate: Promise<void>;
    /** Fires when that fetch reaches the gate (before `gate` settles). */
    onBlocked?: () => void;
    /** Fires after `gate` settles and the blocked list fetch is about to respond. */
    onGateReleased?: () => void;
  };
  /** Awaits `gate` before responding on fetch N and every later threads list fetch. */
  blockThreadsListFromFetch?: { fetchNumber: number; gate: Promise<void> };
  /** Awaits `gate` on the Nth `/api/adam/ideas` fetch (each `loadStudioData` issues one). */
  blockLoadStudioDataFromIdeasFetch?: {
    fetchNumber: number;
    gate: Promise<void>;
    onBlocked?: () => void;
  };
}) {
  let threadsListFetchCount = 0;
  let ideasFetchCount = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes("/api/admin/config")) {
      return new Response(
        JSON.stringify({ privyConfigured: true, adamTokenConfigured: true }),
        { status: 200 },
      );
    }
    if (url.includes("/api/admin/me")) {
      return new Response(
        JSON.stringify({ userId: "fixture-user", isAdmin: true }),
        { status: 200 },
      );
    }
    if (url.includes("/api/adam/chat/threads/thread_fixture_")) {
      const threadId = url.split("/").pop() ?? "thread_fixture_a";
      return new Response(
        JSON.stringify({
          thread: { id: threadId, title: threadId.includes("_b") ? "Thread B" : "Thread A" },
          messages: [
            {
              id: "msg_1",
              role: "user",
              content: "Prior message",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (
      url.includes("/api/adam/chat/threads") &&
      !url.includes("/api/adam/chat/threads/thread_fixture_")
    ) {
      threadsListFetchCount += 1;
      const n = threadsListFetchCount;
      const blockOne = options?.blockThreadsListOnFetch;
      if (blockOne && n === blockOne.fetchNumber) {
        blockOne.onBlocked?.();
        await blockOne.gate;
        blockOne.onGateReleased?.();
      }
      const blockFrom = options?.blockThreadsListFromFetch;
      if (blockFrom && n >= blockFrom.fetchNumber) {
        await blockFrom.gate;
      }
      if (options?.delayThreadsListUntil) {
        await options.delayThreadsListUntil;
      }
      return new Response(JSON.stringify({ threads: FIXTURE_THREADS }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/adam/chat") && init?.method === "POST") {
      if (options?.chatHandler) return options.chatHandler(init);
      return new Response(JSON.stringify({ reply: "Fixture reply from Adam." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/adam/ideas")) {
      ideasFetchCount += 1;
      const blockIdeas = options?.blockLoadStudioDataFromIdeasFetch;
      if (blockIdeas && ideasFetchCount === blockIdeas.fetchNumber) {
        blockIdeas.onBlocked?.();
        await blockIdeas.gate;
      }
      return new Response(JSON.stringify({ ideas: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/adam/")) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/approvals")) {
      return new Response(JSON.stringify({ approvals: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
}

describe("Adam chat loading indicator", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  it("idle: send enabled before first message", async () => {
    mockStudioFetch();
    localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
    render(
      <AppProviders>
        <AdamStudio />
      </AppProviders>,
    );
    await screen.findByTestId("adam-chat-transcript");
    expect(screen.getByTestId("adam-chat-send")).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Message Adam/i), {
      target: { value: "Hello" },
    });
    expect(screen.getByTestId("adam-chat-send")).not.toBeDisabled();
  });

  it("waiting: shows thinking bubble and disables send while POST is pending", async () => {
    let resolveChat!: (value: Response) => void;
    const chatPending = new Promise<Response>((resolve) => {
      resolveChat = resolve;
    });
    mockStudioFetch({ chatHandler: () => chatPending as Promise<Response> });
    localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
    render(
      <AppProviders>
        <AdamStudio />
      </AppProviders>,
    );
    await screen.findByRole("button", { name: "Thread A" });
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Hello Adam" } });
    fireEvent.click(screen.getByTestId("adam-chat-send"));

    expect(await screen.findByTestId("adam-thinking-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("adam-chat-send")).toBeDisabled();

    resolveChat(
      new Response(JSON.stringify({ reply: "Hi!" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("adam-thinking-indicator")).not.toBeInTheDocument(),
    );
    await waitFor(
      () => expect(screen.getByText("Hi!")).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it("error: announces failure in the generation status region until the next send", async () => {
    mockStudioFetch({
      chatHandler: () =>
        new Response(JSON.stringify({ error: "Adam unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
    });
    localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
    render(
      <AppProviders>
        <AdamStudio />
      </AppProviders>,
    );
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Trigger error" } });
    fireEvent.click(screen.getByTestId("adam-chat-send"));

    await waitFor(() =>
      expect(screen.queryByTestId("adam-thinking-indicator")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("adam-chat-generation-status")).toHaveTextContent(
      "Adam could not finish the response",
    );

    fireEvent.change(input, { target: { value: "Try again" } });
    fireEvent.click(screen.getByTestId("adam-chat-send"));
    await waitFor(() =>
      expect(screen.getByTestId("adam-chat-generation-status")).toHaveTextContent(
        "Adam is thinking",
      ),
    );
  });

  it("aborts in-flight chat when the studio unmounts", async () => {
    let capturedSignal: AbortSignal | undefined;
    mockStudioFetch({
      chatHandler: (_init) => {
        capturedSignal = _init?.signal ?? undefined;
        return new Promise<Response>(() => {
          /* never resolves */
        });
      },
    });
    localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
    const view = render(
      <AppProviders>
        <AdamStudio />
      </AppProviders>,
    );
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Abort me" } });
    fireEvent.click(screen.getByTestId("adam-chat-send"));
    await waitFor(() => expect(capturedSignal).toBeDefined());
    view.unmount();
    await waitFor(() => expect(capturedSignal?.aborted).toBe(true));
  });

  it("aborts in-flight chat when switching threads", async () => {
    let capturedSignal: AbortSignal | undefined;
    mockStudioFetch({
      chatHandler: (init) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => {
          /* never resolves */
        });
      },
    });
    localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
    render(
      <AppProviders>
        <AdamStudio />
      </AppProviders>,
    );
    await screen.findByRole("button", { name: "Thread B" });
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "On thread A" } });
    fireEvent.click(screen.getByTestId("adam-chat-send"));
    await waitFor(() => expect(capturedSignal).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "Thread B" }));
    await waitFor(() => expect(capturedSignal?.aborted).toBe(true));
  });

  it("aborts the previous in-flight chat when sending again", async () => {
    const signals: AbortSignal[] = [];
    mockStudioFetch({
      chatHandler: (init) => {
        signals.push(init?.signal as AbortSignal);
        return new Promise<Response>(() => {
          /* never resolves */
        });
      },
    });
    localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
    render(
      <AppProviders>
        <AdamStudio />
      </AppProviders>,
    );
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "First message" } });
    fireEvent.keyDown(input, {
      key: "Enter",
      code: "Enter",
      metaKey: true,
    });
    fireEvent.change(input, { target: { value: "Second message" } });
    fireEvent.keyDown(input, {
      key: "Enter",
      code: "Enter",
      metaKey: true,
    });
    await waitFor(() => expect(signals.length).toBeGreaterThanOrEqual(2));
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });

  it("keeps the first assistant reply when thread list auto-select races with a new chat send", async () => {
    let resolveThreadsList!: () => void;
    const threadsListBlocked = new Promise<void>((resolve) => {
      resolveThreadsList = resolve;
    });
    let resolveChat!: (value: Response) => void;
    const chatPending = new Promise<Response>((resolve) => {
      resolveChat = resolve;
    });
    mockStudioFetch({
      delayThreadsListUntil: threadsListBlocked,
      chatHandler: () => chatPending as Promise<Response>,
    });
    localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
    render(
      <AppProviders>
        <AdamStudio />
      </AppProviders>,
    );
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Before threads load" } });
    fireEvent.click(screen.getByTestId("adam-chat-send"));
    expect(await screen.findByTestId("adam-thinking-indicator")).toBeInTheDocument();

    resolveThreadsList();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Thread A" })).toBeInTheDocument(),
    );

    resolveChat(
      new Response(
        JSON.stringify({
          reply: "Done after thread auto-select.",
          threadId: "thread_fixture_a",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("adam-thinking-indicator")).not.toBeInTheDocument(),
    );
    await waitFor(
      () =>
        expect(screen.getByText("Done after thread auto-select.")).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it(
    "does not reset generation phase to idle when a stale chat finishes after loadStudioData",
    async () => {
    let releaseStudioReload!: () => void;
    const studioReloadBlocked = new Promise<void>((resolve) => {
      releaseStudioReload = resolve;
    });
    let postDraftLoadStudioDataBlocked = false;
    let chatPostCount = 0;
    mockStudioFetch({
      // ideas #1 = mount loadStudioData; #2 = post-draft await loadStudioData only
      blockLoadStudioDataFromIdeasFetch: {
        fetchNumber: 2,
        gate: studioReloadBlocked,
        onBlocked: () => {
          postDraftLoadStudioDataBlocked = true;
        },
      },
      chatHandler: () => {
        chatPostCount += 1;
        if (chatPostCount === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                reply: "Created a draft.",
                createdDraft: { title: "Fixture draft" },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        return new Promise<Response>(() => {
          /* second send stays in-flight */
        });
      },
    });
    localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
    render(
      <AppProviders>
        <AdamStudio />
      </AppProviders>,
    );
    try {
      const input = await screen.findByLabelText(/Message Adam/i);
      await screen.findByRole("button", { name: "Thread A" });
      fireEvent.change(input, { target: { value: "Create draft" } });
      fireEvent.keyDown(input, {
        key: "Enter",
        code: "Enter",
        metaKey: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId("adam-chat-generation-status")).toHaveTextContent(
          "Adam is thinking",
        ),
      );

      await waitFor(
        () => expect(postDraftLoadStudioDataBlocked).toBe(true),
        {
          timeout: 5_000,
          onTimeout: (error) =>
            new Error(
              `${error.message}\nExpected post-draft loadStudioData (ideas fetch #2) to reach the gate.`,
            ),
        },
      );

      fireEvent.change(input, { target: { value: "Second while reload pending" } });
      fireEvent.keyDown(input, {
        key: "Enter",
        code: "Enter",
        metaKey: true,
      });
      await waitFor(() => expect(chatPostCount).toBe(2));

      releaseStudioReload();
      // Let the stale request finish `await loadStudioData()`; without
      // `isCurrentRequest` guards this window clears the second send's UI.
      await act(async () => {
        for (let i = 0; i < 8; i++) {
          await new Promise((r) => setTimeout(r, 25));
          expect(screen.getByTestId("adam-chat-generation-status")).toHaveTextContent(
            "Adam is thinking",
          );
          expect(screen.getByTestId("adam-thinking-indicator")).toBeInTheDocument();
        }
      });
    } finally {
      releaseStudioReload();
      cleanup();
    }
    },
    15_000,
  );
});
