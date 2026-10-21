/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
            JSON.stringify({ userId: "did:privy:test-user", isAdmin: true }),
            { status: 200 },
          );
        }
        return new Response("{}", { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists four owner tool cards including Metrics", () => {
    expect(ADMIN_OWNER_TOOL_LINKS).toHaveLength(4);
    expect(ADMIN_OWNER_TOOL_LINKS.some((l) => l.href === "/admin/metrics")).toBe(
      true,
    );
  });

  it("renders four tool links when signed in", () => {
    render(<AdminConsole />);

    for (const tool of ADMIN_OWNER_TOOL_LINKS) {
      expect(screen.getByRole("link", { name: new RegExp(tool.title.replace("→", "").trim(), "i") })).toHaveAttribute(
        "href",
        tool.href,
      );
    }
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
});
