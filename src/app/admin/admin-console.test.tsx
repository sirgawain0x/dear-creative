/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_TOKEN_STORAGE_KEY } from "@/components/providers/app-providers";
import { ADMIN_OWNER_TOOL_LINKS, AdminConsole } from "./admin-console";

vi.mock("./admin-payouts-card", () => ({
  AdminPayoutsCard: () => <div data-testid="admin-payouts-card">Payouts</div>,
}));

const mockUseAuthSession = vi.fn();

vi.mock("@/components/providers/app-providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/providers/app-providers")>();
  return {
    ...actual,
    useAuthSession: () => mockUseAuthSession(),
  };
});

function defaultPrivySignedInSession() {
  return {
    ready: true,
    isSignedIn: true,
    authenticated: true,
    hasStudioToken: false,
    user: { id: "did:privy:test-user" },
    login: vi.fn(),
    signOut: vi.fn(),
    getAccessToken: vi.fn(async () => "test-token"),
    privyConfigured: true,
    privyTimedOut: false,
  };
}

describe("AdminConsole owner tools", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseAuthSession.mockReturnValue(defaultPrivySignedInSession());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/admin/config")) {
          return new Response(JSON.stringify({ walletEnabled: false }), {
            status: 200,
          });
        }
        if (url.includes("/api/admin/me")) {
          return new Response(
            JSON.stringify({
              userId: "did:privy:test-user",
              isAdmin: true,
              mode: "privy_admin",
            }),
            { status: 200 },
          );
        }
        return new Response("{}", { status: 404 });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("lists four owner tool cards including Metrics", () => {
    expect(ADMIN_OWNER_TOOL_LINKS).toHaveLength(4);
    expect(ADMIN_OWNER_TOOL_LINKS.some((l) => l.href === "/admin/metrics")).toBe(
      true,
    );
  });

  it("renders four tool links when signed in", async () => {
    render(<AdminConsole />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/admin/me",
        expect.objectContaining({
          headers: { Authorization: "Bearer test-token" },
        }),
      );
    });

    for (const tool of ADMIN_OWNER_TOOL_LINKS) {
      expect(screen.getByRole("link", { name: new RegExp(tool.title.replace("→", "").trim(), "i") })).toHaveAttribute(
        "href",
        tool.href,
      );
    }
  });

  it("shows payouts card after Privy /me returns privy_admin", async () => {
    render(<AdminConsole />);

    await waitFor(() => {
      expect(screen.getByTestId("admin-payouts-card")).toBeInTheDocument();
    });
  });

  it("shows Privy sign-in note for studio-key-only sessions", () => {
    mockUseAuthSession.mockReturnValue({
      ...defaultPrivySignedInSession(),
      authenticated: false,
      hasStudioToken: true,
      user: null,
    });

    render(<AdminConsole />);

    expect(
      screen.getByTestId("admin-payouts-privy-sign-in-note"),
    ).toHaveTextContent("Sign in with Privy to view payouts");
    expect(screen.queryByTestId("admin-payouts-card")).not.toBeInTheDocument();
  });

  it("shows note (not card) when /me returns isAdmin with adam_token mode", async () => {
    mockUseAuthSession.mockReturnValue({
      ...defaultPrivySignedInSession(),
      authenticated: false,
      hasStudioToken: true,
      user: null,
      getAccessToken: vi.fn(async () => null),
    });
    window.localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "studio-bearer-token");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/admin/config")) {
          return new Response(JSON.stringify({ walletEnabled: false }), {
            status: 200,
          });
        }
        if (url.includes("/api/admin/me")) {
          return new Response(
            JSON.stringify({
              userId: "adam-token",
              isAdmin: true,
              mode: "adam_token",
            }),
            { status: 200 },
          );
        }
        return new Response("{}", { status: 404 });
      }),
    );

    render(<AdminConsole />);

    fireEvent.click(
      screen.getByRole("button", { name: /Verify Server Token/i }),
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/admin/me",
        expect.objectContaining({
          headers: { Authorization: "Bearer studio-bearer-token" },
        }),
      );
    });

    expect(
      screen.getByTestId("admin-payouts-privy-sign-in-note"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin-payouts-card")).not.toBeInTheDocument();
  });
});
