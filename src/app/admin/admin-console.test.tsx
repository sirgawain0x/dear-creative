/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ADMIN_OWNER_TOOL_LINKS, AdminConsole } from "./admin-console";

vi.mock("./admin-payouts-card", () => ({
  AdminPayoutsCard: () => null,
}));

vi.mock("@/components/providers/app-providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/providers/app-providers")>();
  return {
    ...actual,
    useAuthSession: () => ({
      ready: true,
      isSignedIn: true,
      user: { id: "did:privy:test-user" },
      login: vi.fn(),
      signOut: vi.fn(),
      getAccessToken: vi.fn(async () => "test-token"),
      privyConfigured: true,
      privyTimedOut: false,
    }),
  };
});

describe("AdminConsole owner tools", () => {
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
});
