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

describe("HomeAboutSection", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    getAuthorBySlug.mockReset();
  });

  it("renders when g2 has a non-empty bio", async () => {
    getAuthorBySlug.mockResolvedValue({
      name: "G2",
      slug: "g2",
      bio: "Onchain builder and editor.",
      avatarUrl: null,
      meTokenAddress: null,
      meTokenSymbol: null,
    });
    const { HomeAboutSection } = await import("./home-about-section");
    const view = await HomeAboutSection();
    expect(view).not.toBeNull();
    render(view!);
    expect(screen.getByRole("heading", { name: /About this publication/i })).toBeTruthy();
    expect(screen.getAllByText(/Onchain builder and editor/i).length).toBeGreaterThan(
      0,
    );
  });

  it("returns null when g2 is missing", async () => {
    getAuthorBySlug.mockResolvedValue(null);
    const { HomeAboutSection } = await import("./home-about-section");
    const view = await HomeAboutSection();
    expect(view).toBeNull();
  });

  it("returns null when bio is empty or whitespace", async () => {
    getAuthorBySlug.mockResolvedValue({
      name: "G2",
      slug: "g2",
      bio: "   ",
      avatarUrl: null,
      meTokenAddress: null,
      meTokenSymbol: null,
    });
    const { HomeAboutSection } = await import("./home-about-section");
    const view = await HomeAboutSection();
    expect(view).toBeNull();
  });
});
