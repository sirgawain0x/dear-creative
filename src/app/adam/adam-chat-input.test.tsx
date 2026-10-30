/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function mockStudioFetch(options?: {
  chatHandler?: (init: RequestInit) => Response | Promise<Response>;
}) {
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
    if (url.includes("/api/adam/chat/threads")) {
      return new Response(JSON.stringify({ threads: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/adam/chat") && init?.method === "POST") {
      if (options?.chatHandler) return options.chatHandler(init);
      return new Response(JSON.stringify({ reply: "Fixture reply." }), {
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

function renderAdamChat() {
  localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
  render(
    <AppProviders>
      <AdamStudio />
    </AppProviders>,
  );
}

function chatShortcutEnter(input: HTMLElement, modifier: "meta" | "ctrl" = "meta") {
  fireEvent.keyDown(input, {
    key: "Enter",
    code: "Enter",
    metaKey: modifier === "meta",
    ctrlKey: modifier === "ctrl",
  });
}

describe("Adam chat input", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("plain Enter does not send (Shift+Enter also does not send)", async () => {
    let chatPostCount = 0;
    mockStudioFetch({
      chatHandler: () => {
        chatPostCount += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ reply: "nope" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    });
    renderAdamChat();
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Line one" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(input, {
      key: "Enter",
      code: "Enter",
      shiftKey: true,
    });
    await waitFor(() => expect(chatPostCount).toBe(0));
    expect(screen.getByTestId("adam-chat-send")).not.toBeDisabled();
  });

  it("clicking Send posts once", async () => {
    let chatPostCount = 0;
    mockStudioFetch({
      chatHandler: () => {
        chatPostCount += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ reply: "Sent once." }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    });
    renderAdamChat();
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Hello Adam" } });
    fireEvent.click(screen.getByTestId("adam-chat-send"));
    await waitFor(() => expect(chatPostCount).toBe(1));
    // The reply render can exceed waitFor's 1s default under full-suite /
    // CI load, which made this test flaky (failed ~half of local runs and
    // intermittently in CI). Give the render assertion a longer budget;
    // the behavior under test (one POST, reply shown) is unchanged.
    await waitFor(
      () => expect(screen.getByText("Sent once.")).toBeInTheDocument(),
      { timeout: 10_000 },
    );
  });

  it("rapid double-click on Send posts once while the first request is in flight", async () => {
    let chatPostCount = 0;
    mockStudioFetch({
      chatHandler: () => {
        chatPostCount += 1;
        return new Promise<Response>(() => {
          /* pending */
        });
      },
    });
    renderAdamChat();
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Double tap" } });
    const send = screen.getByTestId("adam-chat-send");
    fireEvent.click(send);
    fireEvent.click(send);
    await waitFor(() => expect(chatPostCount).toBe(1));
    await waitFor(() => expect(send).toBeDisabled());
  });

  it("Cmd+Enter sends once", async () => {
    let chatPostCount = 0;
    mockStudioFetch({
      chatHandler: () => {
        chatPostCount += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ reply: "Shortcut send." }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    });
    renderAdamChat();
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Shortcut" } });
    chatShortcutEnter(input, "meta");
    await waitFor(() => expect(chatPostCount).toBe(1));
  });

  it("Ctrl+Enter sends once", async () => {
    let chatPostCount = 0;
    mockStudioFetch({
      chatHandler: () => {
        chatPostCount += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ reply: "Ctrl shortcut." }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    });
    renderAdamChat();
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Ctrl path" } });
    chatShortcutEnter(input, "ctrl");
    await waitFor(() => expect(chatPostCount).toBe(1));
  });
});
