/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLinkedInConnect } from "./admin-linkedin-connect";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

describe("AdminLinkedInConnect", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    searchParams.forEach((_value, key) => {
      searchParams.delete(key);
    });
  });

  it("loads status on mount and shows connected state with reconnect", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/api/admin/linkedin/status")) {
        return {
          ok: true,
          json: async () => ({
            connected: true,
            memberName: "Ada Lovelace",
          }),
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        getAccessToken={vi.fn(async () => "privy-admin-token")}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/linkedin/status", {
        headers: { Authorization: "Bearer privy-admin-token" },
      });
    });
    expect(screen.getByText(/connected as ada lovelace/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reconnect/i }),
    ).toBeInTheDocument();
  });

  it("refetches status after linkedin=connected query param", async () => {
    searchParams.set("linkedin", "connected");
    const fetchMock = vi.fn(async (_input: RequestInfo) => ({
      ok: true,
      json: async () => ({ connected: true, memberName: "Ada Lovelace" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        getAccessToken={vi.fn(async () => "privy-admin-token")}
      />,
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter((call) =>
          String(call[0]).endsWith("/api/admin/linkedin/status"),
        ),
      ).toHaveLength(2);
    });
  });

  it("shows readable callback error for linkedin=error reason codes", async () => {
    searchParams.set("linkedin", "error");
    searchParams.set("reason", "invalid_state");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ connected: false }),
      })),
    );

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        getAccessToken={vi.fn(async () => "privy-admin-token")}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/could not be verified/i),
      ).toBeInTheDocument();
    });
  });

  it("starts OAuth by fetching /api/admin/linkedin/auth with Bearer token", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign },
    });

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/api/admin/linkedin/status")) {
        return {
          ok: true,
          json: async () => ({ connected: false }),
        };
      }
      if (url.endsWith("/api/admin/linkedin/auth")) {
        return {
          ok: true,
          json: async () => ({
            url: "https://www.linkedin.com/oauth/v2/authorization?state=test",
          }),
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const getAccessToken = vi.fn(async () => "privy-admin-token");

    render(
      <AdminLinkedInConnect isAdmin={true} getAccessToken={getAccessToken} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/not connected/i)).toBeInTheDocument();
    });
    const connectButton = await screen.findByRole("button", {
      name: /connect linkedin/i,
    });
    expect(connectButton).toBeEnabled();

    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/linkedin/auth", {
        headers: { Authorization: "Bearer privy-admin-token" },
      });
    });
    expect(assign).toHaveBeenCalledWith(
      "https://www.linkedin.com/oauth/v2/authorization?state=test",
    );
  });

  it("renders nothing when not admin", () => {
    const { container } = render(
      <AdminLinkedInConnect
        isAdmin={false}
        getAccessToken={vi.fn(async () => null)}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
