/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLinkedInConnect } from "./admin-linkedin-connect";

describe("AdminLinkedInConnect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts OAuth by fetching /api/admin/linkedin/auth with Bearer token", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign } as Location);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        url: "https://www.linkedin.com/oauth/v2/authorization?state=test",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const getAccessToken = vi.fn(async () => "privy-admin-token");

    render(
      <AdminLinkedInConnect isAdmin={true} getAccessToken={getAccessToken} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /connect linkedin/i }));

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
