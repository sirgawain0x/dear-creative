/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubscribeForm } from "./subscribe-form";

describe("SubscribeForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("submits when sessionStorage is blocked (signupSrc omitted or null)", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({ message: "ok" }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const deny = () => {
      throw new DOMException("Access denied", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(deny);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(deny);

    render(<SubscribeForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "blocked-storage@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const init = firstCall![1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      email?: string;
      signupSrc?: string | null;
    };
    expect(body.email).toBe("blocked-storage@example.test");
    expect(body.signupSrc == null).toBe(true);
  });
});
