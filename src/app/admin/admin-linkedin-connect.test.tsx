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

describe("AdminLinkedInConnect", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    replaceMock.mockReset();
    setWindowLocation("/admin");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts OAuth with same-origin cookie credentials (no bearer header)", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, href: "http://localhost/admin" },
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        url: "https://www.linkedin.com/oauth/v2/authorization?state=test",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminLinkedInConnect isAdmin={true} isSignedIn={true} />);

    fireEvent.click(screen.getByRole("button", { name: /connect linkedin/i }));

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
    render(<AdminLinkedInConnect isAdmin={true} isSignedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: /connect linkedin/i }));
    expect(
      await screen.findByText(/sign in with privy before connecting linkedin/i),
    ).toBeInTheDocument();
  });

  it("renders nothing when not admin", () => {
    const { container } = render(
      <AdminLinkedInConnect isAdmin={false} isSignedIn={true} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows success banner for linkedin=connected and clears query params", async () => {
    mockSearchParams = new URLSearchParams("linkedin=connected");
    setWindowLocation("/admin?linkedin=connected");

    render(<AdminLinkedInConnect isAdmin={true} isSignedIn={true} />);

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

    render(<AdminLinkedInConnect isAdmin={true} isSignedIn={true} />);

    const banner = await screen.findByTestId("admin-linkedin-callback-banner");
    expect(banner).toHaveTextContent(linkedInCallbackErrorMessage(reason));
  });

  it("shows generic fallback for unknown reason codes", async () => {
    mockSearchParams = new URLSearchParams(
      "linkedin=error&reason=unknown_reason_code",
    );
    setWindowLocation("/admin?linkedin=error&reason=unknown_reason_code");

    render(<AdminLinkedInConnect isAdmin={true} isSignedIn={true} />);

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

    render(<AdminLinkedInConnect isAdmin={true} isSignedIn={true} />);

    await screen.findByTestId("admin-linkedin-callback-banner");
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/admin?tab=metrics", {
        scroll: false,
      });
    });
  });
});
