/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { setPaywallEnabledForTests } from "@/lib/paywall/feature-flag";

vi.mock("@/components/subscribe-form", () => ({
  SubscribeForm: () => <div data-testid="subscribe-form">form</div>,
}));

describe("HomeSubscribeCta", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
  });

  it("always shows free subscribe copy and form", async () => {
    setPaywallEnabledForTests(false);
    const { HomeSubscribeCta } = await import("./home-subscribe-cta");
    render(<HomeSubscribeCta />);
    expect(screen.getByTestId("subscribe-form")).toBeTruthy();
    expect(screen.getByText(/Free newsletter with double opt-in/i)).toBeTruthy();
    expect(screen.queryByText(/Paid dispatches/i)).toBeNull();
  });

  it("shows paid unlock panel when paywall is enabled", async () => {
    setPaywallEnabledForTests(true);
    const { HomeSubscribeCta } = await import("./home-subscribe-cta");
    render(<HomeSubscribeCta />);
    expect(screen.getByText(/Paid dispatches/i)).toBeTruthy();
    expect(screen.queryByText(/same wallet flow/i)).toBeNull();
    expect(screen.getByRole("link", { name: /Browse dispatches/i })).toHaveAttribute(
      "href",
      "/posts",
    );
  });
});
