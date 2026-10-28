/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOME_SUBSCRIBE_SECTION_ID } from "./home/home-subscribe-cta";
import { onSubscribeNavClick } from "./site-header";

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

const mockUsePathname = vi.fn(() => "/posts");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("./providers/app-providers", () => ({
  useAuthSession: () => ({
    isSignedIn: false,
    authenticated: false,
    signOut: vi.fn(),
    login: vi.fn(),
    privyConfigured: true,
    privyTimedOut: false,
  }),
}));

describe("onSubscribeNavClick (homepage)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrolls to subscribe in-page and runs afterNavigate", () => {
    const section = document.createElement("section");
    section.id = HOME_SUBSCRIBE_SECTION_ID;
    section.getBoundingClientRect = () =>
      ({
        top: 200,
        bottom: 400,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 200,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(section);
    Object.defineProperty(window, "scrollY", { value: 100, configurable: true });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      scrollMarginTop: "64px",
    } as CSSStyleDeclaration);

    const afterNavigate = vi.fn();
    const preventDefault = vi.fn();
    const handler = onSubscribeNavClick("/", afterNavigate);
    handler({
      preventDefault,
    } as unknown as React.MouseEvent<HTMLAnchorElement>);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 236, behavior: "smooth" });
    expect(afterNavigate).toHaveBeenCalledTimes(1);
    section.remove();
  });
});

describe("SiteHeader mobile Subscribe nav", () => {
  afterEach(() => {
    cleanup();
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue("/posts");
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it("closes the drawer when Subscribe is tapped off the homepage", async () => {
    const { SiteHeader } = await import("./site-header");
    render(<SiteHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle navigation menu" }));
    const mobileNav = screen.getByRole("navigation", { name: "Mobile navigation" });
    const subscribe = within(mobileNav).getByRole("link", { name: "Subscribe" });
    expect(subscribe).toHaveAttribute("href", "/#subscribe");

    fireEvent.click(subscribe);

    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle navigation menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
