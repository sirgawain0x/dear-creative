/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminPayoutsSection } from "./admin-payouts-section";

vi.mock("./admin-payouts-card", () => ({
  AdminPayoutsCard: () => <div data-testid="admin-payouts-card">Payouts</div>,
}));

describe("AdminPayoutsSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders card for privy_admin session when Privy-authenticated", () => {
    render(
      <AdminPayoutsSection
        session={{
          userId: "did:privy:admin",
          isAdmin: true,
          mode: "privy_admin",
        }}
        isSignedIn
        authenticated
      />,
    );

    expect(screen.getByTestId("admin-payouts-card")).toBeInTheDocument();
    expect(
      screen.queryByTestId("admin-payouts-privy-sign-in-note"),
    ).not.toBeInTheDocument();
  });

  it("renders note when /me isAdmin but mode is adam_token", () => {
    render(
      <AdminPayoutsSection
        session={{
          userId: "adam-token",
          isAdmin: true,
          mode: "adam_token",
        }}
        isSignedIn
        authenticated={false}
      />,
    );

    expect(
      screen.getByTestId("admin-payouts-privy-sign-in-note"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin-payouts-card")).not.toBeInTheDocument();
  });
});
