/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/server", () => ({
  connection: async () => {},
}));

const { getAuthorBySlug } = vi.hoisted(() => ({
  getAuthorBySlug: vi.fn(),
}));

vi.mock("@/lib/posts/post-author", () => ({
  getAuthorBySlug,
}));

vi.mock("@/db/client", () => ({
  getDb: () => ({}),
}));

const G2_TAGLINE =
  "Music producer and builder helping creators own their work and their audience.";

describe("HomeAboutSection", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    getAuthorBySlug.mockReset();
  });

  it("renders tagline without truncation when g2 has bio and tagline", async () => {
    getAuthorBySlug.mockResolvedValue({
      name: "G2",
      slug: "g2",
      bio: "Onchain builder and editor.",
      tagline: G2_TAGLINE,
      avatarUrl: null,
      meTokenAddress: null,
      meTokenSymbol: null,
    });
    const { HomeAboutSection } = await import("./home-about-section");
    const view = await HomeAboutSection();
    expect(view).not.toBeNull();
    render(view!);
    expect(
      screen.getByRole("heading", { name: /About this publication/i }),
    ).toBeTruthy();
    const tagline = screen.getByTestId("author-tagline");
    expect(tagline.textContent).toBe(G2_TAGLINE);
    expect(tagline.className).not.toMatch(/line-clamp/);
    expect(screen.getByText(/Onchain builder and editor/i)).toBeTruthy();
  });

  it("returns null when g2 is missing", async () => {
    getAuthorBySlug.mockResolvedValue(null);
    const { HomeAboutSection } = await import("./home-about-section");
    const view = await HomeAboutSection();
    expect(view).toBeNull();
  });

  it("returns null when bio and tagline are empty", async () => {
    getAuthorBySlug.mockResolvedValue({
      name: "G2",
      slug: "g2",
      bio: "   ",
      tagline: null,
      avatarUrl: null,
      meTokenAddress: null,
      meTokenSymbol: null,
    });
    const { HomeAboutSection } = await import("./home-about-section");
    const view = await HomeAboutSection();
    expect(view).toBeNull();
  });

  it("renders when only tagline is present", async () => {
    getAuthorBySlug.mockResolvedValue({
      name: "G2",
      slug: "g2",
      bio: null,
      tagline: G2_TAGLINE,
      avatarUrl: null,
      meTokenAddress: null,
      meTokenSymbol: null,
    });
    const { HomeAboutSection } = await import("./home-about-section");
    const view = await HomeAboutSection();
    expect(view).not.toBeNull();
    render(view!);
    expect(screen.getByTestId("author-tagline").textContent).toBe(G2_TAGLINE);
  });
});
