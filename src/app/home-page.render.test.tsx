/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NEWSLETTER_POSTAL_ADDRESS } from "@/components/site-footer";
import type { PublishedPostListItem } from "@/lib/posts/published-posts";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/server", () => ({
  connection: async () => {},
}));

vi.mock("@/components/home/active-subscriber-line", () => ({
  ActiveSubscriberLine: () => null,
}));

vi.mock("@/components/home/home-subscribe-cta", () => ({
  HomeSubscribeCta: () => <div data-testid="home-subscribe-cta" />,
  HOME_SUBSCRIBE_SECTION_ID: "subscribe",
}));

const mockUsePathname = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("@/components/home/home-about-section", () => ({
  HomeAboutSection: async () => null,
}));

function sampleSpotlightPost(index: number): PublishedPostListItem {
  return {
    slug: `render-spotlight-${index}`,
    title: `Dispatch ${index}`,
    publishedAt: "2024-01-01T00:00:00.000Z",
    canonicalUrl: null,
    coverImage: "data:image/svg+xml;utf8,%3Csvg/%3E",
    teaser: `Teaser ${index}`,
    isGated: false,
  };
}

const { getCachedHomeSpotlightPosts } = vi.hoisted(() => ({
  getCachedHomeSpotlightPosts: vi.fn(),
}));

vi.mock("@/lib/posts/cached-home-spotlight-posts", () => ({
  getCachedHomeSpotlightPosts,
}));

vi.mock("@/components/home/post-spotlight-cover-image", () => ({
  PostSpotlightCoverImage: () => <div data-testid="cover" />,
}));

describe("Home page (rendered)", () => {
  afterEach(() => {
    cleanup();
    getCachedHomeSpotlightPosts.mockReset();
  });

  it("renders hero and CTAs without the postal address in main content", async () => {
    getCachedHomeSpotlightPosts.mockResolvedValue([]);
    const Home = (await import("./page")).default;
    render(<Home />);
    expect(screen.getByRole("heading", { name: /^Dear Creative$/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Explore Dispatches/i })).toBeNull();
    expect(screen.getByRole("link", { name: /Subscribe Free/i })).toHaveAttribute(
      "href",
      "#subscribe",
    );
    expect(screen.queryByText(NEWSLETTER_POSTAL_ADDRESS)).toBeNull();
    expect(screen.queryByText(/Dover, Delaware/i)).toBeNull();
  });
});

describe("HomeSpotlight (rendered)", () => {
  afterEach(() => {
    cleanup();
    getCachedHomeSpotlightPosts.mockReset();
  });

  it("lists each cached spotlight post and links to the full archive", async () => {
    const posts = Array.from({ length: 12 }, (_, i) => sampleSpotlightPost(i));
    getCachedHomeSpotlightPosts.mockResolvedValue(posts);
    const { HomeSpotlight } = await import("@/components/home/home-spotlight");
    const view = await HomeSpotlight();
    render(view);
    expect(screen.getByRole("link", { name: /See all posts/i })).toHaveAttribute(
      "href",
      "/posts",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByRole("heading", { name: /Dispatch 11/i })).toBeTruthy();
  });
});
