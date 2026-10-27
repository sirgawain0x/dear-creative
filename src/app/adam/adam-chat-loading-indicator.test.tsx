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

function mockStudioFetch(chatHandler?: (init: RequestInit) => Response | Promise<Response>) {
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
    if (url.includes("/api/adam/chat") && init?.method === "POST") {
      if (chatHandler) return chatHandler(init);
      return new Response(JSON.stringify({ reply: "Fixture reply from Adam." }), {
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
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
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
    mockStudioFetch(() => chatPending as Promise<Response>);
    localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
    render(
      <AppProviders>
        <AdamStudio />
      </AppProviders>,
    );
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Hello Adam" } });
    fireEvent.click(screen.getAllByTestId("adam-chat-send")[0]!);

    expect(await screen.findByTestId("adam-thinking-indicator")).toBeInTheDocument();
    expect(screen.getAllByTestId("adam-chat-send")[0]).toBeDisabled();

    resolveChat(
      new Response(JSON.stringify({ reply: "Hi!" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("adam-thinking-indicator")).not.toBeInTheDocument(),
    );
  });

  it("error: clears indicator and re-enables send", async () => {
    mockStudioFetch(
      () =>
        new Response(JSON.stringify({ error: "Adam unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
    );
    localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-key");
    render(
      <AppProviders>
        <AdamStudio />
      </AppProviders>,
    );
    const input = await screen.findByLabelText(/Message Adam/i);
    fireEvent.change(input, { target: { value: "Trigger error" } });
    fireEvent.click(screen.getAllByTestId("adam-chat-send")[0]!);

    await waitFor(() =>
      expect(screen.queryByTestId("adam-thinking-indicator")).not.toBeInTheDocument(),
    );
    fireEvent.change(input, { target: { value: "Try again" } });
    await waitFor(() =>
      expect(screen.getAllByTestId("adam-chat-send")[0]).not.toBeDisabled(),
    );
  });
});
