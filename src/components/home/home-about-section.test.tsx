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

  it("renders loaded author bio from the writers table", async () => {
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
    render(view);
    expect(screen.getAllByText(/Onchain builder and editor/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(/\[Placeholder\]/i)).toBeNull();
  });

  it("uses marked placeholder copy when g2 is missing", async () => {
    getAuthorBySlug.mockResolvedValue(null);
    const { HomeAboutSection } = await import("./home-about-section");
    const view = await HomeAboutSection();
    render(view);
    expect(screen.getAllByText(/\[Placeholder\]/i).length).toBeGreaterThan(0);
  });
});
