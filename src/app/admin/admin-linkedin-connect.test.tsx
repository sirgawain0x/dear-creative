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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LINKEDIN_CALLBACK_SUCCESS_MESSAGE } from "@/lib/linkedin/callback-banner-messages";
import { linkedInCallbackErrorMessage } from "@/lib/linkedin/callback-banner-messages";
import { LINKEDIN_CALLBACK_REASONS } from "@/lib/linkedin/reason-codes";

const replaceMock = vi.fn();
let mockSearchParams = new URLSearchParams();
const getAccessTokenMock = vi.fn(
  async (): Promise<string | null> => "privy-admin-token",
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => mockSearchParams,
}));

import { AdminLinkedInConnect } from "./admin-linkedin-connect";

function setWindowLocation(pathAndQuery: string) {
  const url = new URL(pathAndQuery, "http://localhost");
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...window.location,
      href: url.href,
      pathname: url.pathname,
      search: url.search,
    },
  });
}

function statusFetchResponse(connected: boolean) {
  return {
    ok: true,
    json: async () => ({ connected }),
  };
}

function defaultFetchMock(
  statusConnected = false,
): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo) => {
    const url = String(input);
    if (url.endsWith("/api/admin/linkedin/status")) {
      return statusFetchResponse(statusConnected);
    }
    if (url.endsWith("/api/admin/linkedin/auth")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          url: "https://www.linkedin.com/oauth/v2/authorization?state=test",
        }),
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

describe("AdminLinkedInConnect", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    replaceMock.mockReset();
    getAccessTokenMock.mockReset();
    getAccessTokenMock.mockResolvedValue("privy-admin-token");
    setWindowLocation("/admin");
    vi.stubGlobal("fetch", defaultFetchMock());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads status on mount and shows connected state with reconnect", async () => {
    vi.stubGlobal("fetch", defaultFetchMock(true));

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        isSignedIn={true}
        getAccessToken={getAccessTokenMock}
      />,
    );

    await waitFor(() => {
      expect(getAccessTokenMock).toHaveBeenCalled();
    });
    expect(
      screen.getByText(/connected as linkedin member/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reconnect/i }),
    ).toBeInTheDocument();
  });

  it("shows status check error when status API returns 500", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/api/admin/linkedin/status")) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        isSignedIn={true}
        getAccessToken={getAccessTokenMock}
      />,
    );

    expect(
      await screen.findByTestId("admin-linkedin-status-error"),
    ).toHaveTextContent(/couldn't check linkedin status/i);
    expect(screen.queryByText(/^not connected\.$/i)).not.toBeInTheDocument();
  });

  it("shows status check error when access token is missing", async () => {
    getAccessTokenMock.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        isSignedIn={true}
        getAccessToken={getAccessTokenMock}
      />,
    );

    expect(
      await screen.findByTestId("admin-linkedin-status-error"),
    ).toHaveTextContent(/couldn't check linkedin status/i);
    expect(screen.queryByText(/^not connected\.$/i)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refetches status after linkedin=connected query param", async () => {
    mockSearchParams = new URLSearchParams("linkedin=connected");
    setWindowLocation("/admin?linkedin=connected");
    const fetchMock = defaultFetchMock(true);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        isSignedIn={true}
        getAccessToken={getAccessTokenMock}
      />,
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter((call) =>
          String(call[0]).endsWith("/api/admin/linkedin/status"),
        ).length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  it("starts OAuth with same-origin cookie credentials (no bearer header)", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, href: "http://localhost/admin" },
    });

    const fetchMock = defaultFetchMock(false);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        isSignedIn={true}
        getAccessToken={getAccessTokenMock}
      />,
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
        credentials: "include",
      });
    });
    expect(assign).toHaveBeenCalledWith(
      "https://www.linkedin.com/oauth/v2/authorization?state=test",
    );
  });

  it("prompts sign-in when Privy session is missing locally", async () => {
    render(
      <AdminLinkedInConnect
        isAdmin={true}
        isSignedIn={false}
        getAccessToken={getAccessTokenMock}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /connect linkedin/i }),
      ).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /connect linkedin/i }));
    expect(
      await screen.findByText(/sign in with privy before connecting linkedin/i),
    ).toBeInTheDocument();
  });

  it("renders nothing when not admin", () => {
    const { container } = render(
      <AdminLinkedInConnect
        isAdmin={false}
        isSignedIn={true}
        getAccessToken={getAccessTokenMock}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows success banner for linkedin=connected and clears query params", async () => {
    mockSearchParams = new URLSearchParams("linkedin=connected");
    setWindowLocation("/admin?linkedin=connected");

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        isSignedIn={true}
        getAccessToken={getAccessTokenMock}
      />,
    );

    expect(
      await screen.findByTestId("admin-linkedin-callback-banner"),
    ).toHaveTextContent(LINKEDIN_CALLBACK_SUCCESS_MESSAGE);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/admin", { scroll: false });
    });
  });

  it.each(
    LINKEDIN_CALLBACK_REASONS.filter((code) => code !== "connected"),
  )("shows error banner for reason=%s", async (reason) => {
    mockSearchParams = new URLSearchParams(
      `linkedin=error&reason=${reason}`,
    );
    setWindowLocation(`/admin?linkedin=error&reason=${reason}`);

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        isSignedIn={true}
        getAccessToken={getAccessTokenMock}
      />,
    );

    const banner = await screen.findByTestId("admin-linkedin-callback-banner");
    expect(banner).toHaveTextContent(linkedInCallbackErrorMessage(reason));
  });

  it("shows generic fallback for unknown reason codes", async () => {
    mockSearchParams = new URLSearchParams(
      "linkedin=error&reason=unknown_reason_code",
    );
    setWindowLocation("/admin?linkedin=error&reason=unknown_reason_code");

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        isSignedIn={true}
        getAccessToken={getAccessTokenMock}
      />,
    );

    expect(
      await screen.findByTestId("admin-linkedin-callback-banner"),
    ).toHaveTextContent(linkedInCallbackErrorMessage("unknown_reason_code"));
  });

  it("clears linkedin callback params but keeps unrelated search params", async () => {
    mockSearchParams = new URLSearchParams(
      "linkedin=error&reason=invalid_state&tab=metrics",
    );
    setWindowLocation(
      "/admin?linkedin=error&reason=invalid_state&tab=metrics",
    );

    render(
      <AdminLinkedInConnect
        isAdmin={true}
        isSignedIn={true}
        getAccessToken={getAccessTokenMock}
      />,
    );

    await screen.findByTestId("admin-linkedin-callback-banner");
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/admin?tab=metrics", {
        scroll: false,
      });
    });
  });
});
