// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaInstall } from "./pwa-install";

const location = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => location.pathname }));

function offerInstall(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => { window.dispatchEvent(event); });
  return { event, prompt };
}

describe("PWA installation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    location.pathname = "/";
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Chrome");
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("waits before showing the banner and invokes the browser install prompt only on click", async () => {
    render(<PwaInstall />);
    const { prompt, event } = offerInstall();
    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("button", { name: "Install Dear Creative" })).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(prompt).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Install Dear Creative" })); });
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region", { name: "Install Dear Creative" })).toBeNull();
  });

  it("remembers dismissal but keeps installation available on the install page", () => {
    const banner = render(<PwaInstall />);
    offerInstall();
    act(() => { vi.advanceTimersByTime(5000); });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss install reminder" }));
    banner.unmount();
    const revisit = render(<PwaInstall />);
    offerInstall();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole("region", { name: "Install Dear Creative" })).toBeNull();
    revisit.unmount();
    render(<PwaInstall fullPage />);
    offerInstall();
    expect(screen.getByRole("button", { name: "Install Dear Creative" })).toBeTruthy();
  });

  it("gives iOS users home screen instructions without a fake install button", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone");
    render(<PwaInstall />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText("Add to Home Screen")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Install Dear Creative" })).toBeNull();
  });

  it("hides the promotion in an installed app and after appinstalled", () => {
    render(<PwaInstall />);
    offerInstall();
    act(() => { vi.advanceTimersByTime(5000); window.dispatchEvent(new Event("appinstalled")); });
    expect(screen.queryByRole("region", { name: "Install Dear Creative" })).toBeNull();
    cleanup();
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    render(<PwaInstall fullPage />);
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole("status")).toHaveTextContent("You’re using the Dear Creative app");
  });

  it("does not promote installation inside the studio", () => {
    location.pathname = "/adam";
    render(<PwaInstall />);
    offerInstall();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole("region", { name: "Install Dear Creative" })).toBeNull();
  });
});
