/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLogin = vi.fn();
const mockSignOut = vi.fn();

let mockIsSignedIn = false;
let mockAuthenticated = false;
let mockPrivyConfigured = true;
let mockPrivyTimedOut = false;

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("./providers/app-providers", () => ({
  useAuthSession: () => ({
    isSignedIn: mockIsSignedIn,
    authenticated: mockAuthenticated,
    signOut: mockSignOut,
    login: mockLogin,
    privyConfigured: mockPrivyConfigured,
    privyTimedOut: mockPrivyTimedOut,
  }),
}));

describe("SiteHeader auth control", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    mockIsSignedIn = false;
    mockAuthenticated = false;
    mockPrivyConfigured = true;
    mockPrivyTimedOut = false;
    mockLogin.mockReset();
    mockSignOut.mockReset();
    vi.resetModules();
  });

  function mainNav() {
    return within(screen.getByRole("navigation", { name: "Main navigation" }));
  }

  it("renders Sign In button in main navigation when signed out", async () => {
    const { SiteHeader } = await import("./site-header");
    render(<SiteHeader />);

    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("calls Privy login when signed-out user clicks Sign In", async () => {
    const { SiteHeader } = await import("./site-header");
    render(<SiteHeader />);

    fireEvent.click(mainNav().getByRole("button", { name: "Sign In" }));
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it("renders Sign Out button when signed in", async () => {
    mockIsSignedIn = true;
    mockAuthenticated = true;
    const { SiteHeader } = await import("./site-header");
    render(<SiteHeader />);

    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  });

  it("calls signOut when signed-in user clicks Sign Out", async () => {
    mockIsSignedIn = true;
    mockAuthenticated = true;
    const { SiteHeader } = await import("./site-header");
    render(<SiteHeader />);

    fireEvent.click(mainNav().getByRole("button", { name: "Sign Out" }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("calls Privy login when signed-out user clicks Wallet with reader wallet enabled", async () => {
    const { SiteHeader } = await import("./site-header");
    render(<SiteHeader readerWalletEnabled />);

    fireEvent.click(screen.getByTestId("reader-wallet-header-button"));
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it("links Wallet to /admin when signed out and Privy is unavailable", async () => {
    mockPrivyConfigured = false;
    const { SiteHeader } = await import("./site-header");
    render(<SiteHeader readerWalletEnabled />);

    const wallet = screen.getByTestId("reader-wallet-header-button");
    expect(wallet).toHaveAttribute("href", "/admin");
    fireEvent.click(wallet);
    expect(mockLogin).not.toHaveBeenCalled();
    expect(screen.queryByTestId("reader-wallet-sheet")).not.toBeInTheDocument();
  });

  it("does not render Admin or Admin Console links in the header when signed in", async () => {
    mockIsSignedIn = true;
    const { SiteHeader } = await import("./site-header");
    render(<SiteHeader />);

    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Admin Console" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
  });
});
