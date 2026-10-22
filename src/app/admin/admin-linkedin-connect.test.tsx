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

describe("AdminLinkedInConnect", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts OAuth with same-origin cookie credentials (no bearer header)", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign },
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
});
