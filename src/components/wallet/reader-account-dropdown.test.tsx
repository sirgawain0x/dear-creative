/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLogin = vi.fn();
const mockSignOut = vi.fn();
const mockGetAccessToken = vi.fn(async () => "privy-token");

let mockAuthenticated = false;

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("ethereum-blockies-base64", () => ({
  default: () => "data:image/png;base64,blockie",
}));

vi.mock("../providers/app-providers", () => ({
  useAuthSession: () => ({
    authenticated: mockAuthenticated,
    login: mockLogin,
    signOut: mockSignOut,
    getAccessToken: mockGetAccessToken,
    privyConfigured: true,
    privyTimedOut: false,
    ready: true,
  }),
}));

vi.mock("./reader-wallet-panel", () => ({
  ReaderWalletPanel: ({ onOpenCheckout }: { onOpenCheckout: () => void }) => (
    <button type="button" onClick={onOpenCheckout}>Add USDC</button>
  ),
}));

describe("ReaderAccountDropdown", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mockAuthenticated = false;
    mockLogin.mockReset();
    vi.resetModules();
  });

  it("opens Privy login when signed out", async () => {
    const { ReaderAccountDropdown } = await import("./reader-account-dropdown");
    render(<ReaderAccountDropdown surface="desktop" />);
    fireEvent.click(screen.getByTestId("reader-wallet-header-button"));
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it("renders portaled dropdown content when signed in on desktop", async () => {
    mockAuthenticated = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/wallet/me")) {
          return {
            ok: true,
            json: async () => ({
              configured: true,
              address: "0x1234567890abcdef1234567890abcdef12345678",
            }),
          };
        }
        if (url.includes("/api/admin/me")) {
          return { ok: false, json: async () => ({}) };
        }
        throw new Error(`unexpected ${url}`);
      }),
    );

    const { ReaderAccountDropdown } = await import("./reader-account-dropdown");
    render(<ReaderAccountDropdown surface="desktop" />);

    await waitFor(() => {
      expect(screen.getByText("0x1234…5678")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Open account menu")).toBeInTheDocument();
  });
  it.each(["desktop", "mobile"] as const)(
    "keeps checkout open after closing the %s wallet",
    async (surface) => {
      mockAuthenticated = true;
      vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(
        url === "/api/wallet/onramp/embedded"
          ? { checkoutUrl: "https://pay.coinbase.com/checkout" }
          : { configured: false },
      )));
      const { ReaderAccountDropdown } = await import("./reader-account-dropdown");
      render(<ReaderAccountDropdown surface={surface} />);
      const trigger = screen.getByRole("button", { name: "Open account menu" });
      if (surface === "desktop") {
        fireEvent(trigger, new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
      } else {
        fireEvent.click(trigger);
      }
      fireEvent.click(await screen.findByRole("button", { name: "Add USDC" }));
      const amount = await screen.findByRole("textbox", { name: "Amount in USD" });
      expect(screen.queryByRole("button", { name: "Add USDC" })).toBeNull();
      expect(screen.getByRole("button", { name: "Use Coinbase Checkout" })).toBeVisible();
      expect(amount).toHaveFocus();
      fireEvent.change(amount, { target: { value: "25" } });
      fireEvent.click(screen.getByRole("button", { name: "Continue with Apple Pay" }));
      expect(await screen.findByTitle("Coinbase Apple Pay checkout"))
        .toHaveAttribute("src", "https://pay.coinbase.com/checkout");

      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(trigger).toHaveFocus());
    },
  );

});
