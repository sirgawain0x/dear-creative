/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogin = vi.fn();
const mockSignOut = vi.fn();

let mockIsSignedIn = false;

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
    signOut: mockSignOut,
    login: mockLogin,
    privyConfigured: true,
    privyTimedOut: false,
  }),
}));

describe("SiteHeader auth control", () => {
  beforeEach(async () => {
    mockIsSignedIn = false;
    mockLogin.mockReset();
    mockSignOut.mockReset();
    vi.resetModules();
  });

  it("renders Sign In button in main navigation when signed out", async () => {
    const { SiteHeader } = await import("./site-header");
    render(<SiteHeader />);

    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("renders Sign Out button when signed in", async () => {
    mockIsSignedIn = true;
    const { SiteHeader } = await import("./site-header");
    render(<SiteHeader />);

    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  });
});
