/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLogin = vi.fn();
const mockSignOut = vi.fn();

let mockIsSignedIn = false;
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

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("./providers/app-providers", () => ({
  useAuthSession: () => ({
    isSignedIn: mockIsSignedIn,
    authenticated: mockAuthenticated,
    signOut: mockSignOut,
    login: mockLogin,
    privyConfigured: true,
    privyTimedOut: false,
  }),
}));

describe("SiteHeader auth control", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    mockIsSignedIn = false;
    mockAuthenticated = false;
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
