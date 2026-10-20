/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminMetricsClient } from "./admin-metrics-client";
import { MOCK_METRICS_DATA } from "./metrics-fixtures";

const mockUseAuthSession = vi.fn();

vi.mock("@/components/providers/app-providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/providers/app-providers")>();
  return {
    ...actual,
    useAuthSession: () => mockUseAuthSession(),
  };
});

describe("AdminMetricsClient", () => {
  beforeEach(() => {
    mockUseAuthSession.mockReturnValue({
      ready: true,
      isSignedIn: true,
      authenticated: true,
      getAccessToken: vi.fn(async () => "privy-metrics-token"),
      privyConfigured: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fetch metrics while auth session is not ready", async () => {
    mockUseAuthSession.mockReturnValue({
      ready: false,
      isSignedIn: true,
      authenticated: true,
      getAccessToken: vi.fn(async () => "privy-metrics-token"),
      privyConfigured: true,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch");

    const { container } = render(<AdminMetricsClient />);

    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("fetches metrics with Authorization bearer header", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_METRICS_DATA), { status: 200 }),
    );

    render(<AdminMetricsClient />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/metrics",
        expect.objectContaining({
          cache: "no-store",
          headers: { Authorization: "Bearer privy-metrics-token" },
        }),
      );
    });
  });

  it("renders subscriber, delivery, tips, and feedback sections from mocked data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_METRICS_DATA), { status: 200 }),
    );

    render(<AdminMetricsClient />);

    await waitFor(() => {
      expect(screen.getByText("Total Subscribers")).toBeInTheDocument();
    });

    for (const label of [
      "Email Delivery",
      "Social Delivery (X)",
      "Tips Revenue (USDC)",
      "Reader Feedback",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("1284").length).toBeGreaterThan(0);
  });

  it("shows sign-in message without fetching when signed out", async () => {
    mockUseAuthSession.mockReturnValue({
      ready: true,
      isSignedIn: false,
      authenticated: false,
      getAccessToken: vi.fn(async () => null),
      privyConfigured: true,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(<AdminMetricsClient />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /admin page/i })).toHaveAttribute(
        "href",
        "/admin",
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Failed to fetch metrics: 401/i)).toBeNull();
  });
});
