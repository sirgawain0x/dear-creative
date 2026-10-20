/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPayoutsCard } from "./admin-payouts-card";

const mockUseAuthSession = vi.fn();

vi.mock("@/components/providers/app-providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/providers/app-providers")>();
  return {
    ...actual,
    useAuthSession: () => mockUseAuthSession(),
  };
});

describe("AdminPayoutsCard", () => {
  beforeEach(() => {
    mockUseAuthSession.mockReturnValue({
      ready: true,
      isSignedIn: true,
      authenticated: true,
      getAccessToken: vi.fn(async () => "admin-token"),
      privyConfigured: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders checksummed addresses with BaseScan links", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          payoutWalletAddress: "0x1111111111111111111111111111111111111111",
          payoutSplitAddress: "0x2222222222222222222222222222222222222222",
          treasuryAddress: "0xf46F1BA19a9280f752a451d0973b047D81c63D70",
        }),
        { status: 200 },
      ),
    );

    render(<AdminPayoutsCard />);

    await waitFor(() => {
      expect(screen.getByText("Payouts")).toBeInTheDocument();
    });

    expect(
      screen.getByText("0x1111111111111111111111111111111111111111"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("0xf46F1BA19a9280f752a451d0973b047D81c63D70"),
    ).toBeInTheDocument();

    const basescanLinks = screen.getAllByRole("link", { name: "BaseScan" });
    expect(basescanLinks.length).toBeGreaterThan(0);
    expect(basescanLinks[0]).toHaveAttribute(
      "href",
      "https://basescan.org/address/0x1111111111111111111111111111111111111111",
    );
  });

  it("shows Not set for missing addresses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          payoutWalletAddress: null,
          payoutSplitAddress: null,
          treasuryAddress: null,
        }),
        { status: 200 },
      ),
    );

    render(<AdminPayoutsCard />);

    await waitFor(() => {
      expect(screen.getAllByText("Not set").length).toBe(3);
    });
  });
});
