/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOME_SUBSCRIBE_SECTION_ID } from "@/components/home/home-subscribe-cta";
import { HomeHeroSubscribeCta } from "./home-hero-subscribe-cta";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

const mockUsePathname = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("HomeHeroSubscribeCta", () => {
  afterEach(() => {
    cleanup();
    mockUsePathname.mockReturnValue("/");
  });

  it("links to the homepage subscribe anchor without the separate subscribe route", () => {
    render(<HomeHeroSubscribeCta />);
    expect(screen.getByRole("link", { name: /Subscribe Free/i })).toHaveAttribute(
      "href",
      "#subscribe",
    );
    expect(screen.queryByRole("link", { name: /Explore Dispatches/i })).toBeNull();
  });

  it("smooth-scrolls in-page on the homepage using the same handler as nav Subscribe", () => {
    const section = document.createElement("section");
    section.id = HOME_SUBSCRIBE_SECTION_ID;
    section.scrollIntoView = vi.fn();
    document.body.appendChild(section);

    render(<HomeHeroSubscribeCta />);
    fireEvent.click(screen.getByRole("link", { name: /Subscribe Free/i }));

    expect(section.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    section.remove();
  });
});
