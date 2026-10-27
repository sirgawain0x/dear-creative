import { afterEach, describe, expect, it, vi } from "vitest";
import { setPreviewLinksEnabledForTests } from "@/lib/preview-links/feature-flag";

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);
const resolvePreviewLinkByTokenMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: false, reason: "invalid" }),
);
const getAdminPostByIdOrSlugMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("next/server", () => ({
  connection: async () => undefined,
}));

vi.mock("@/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/lib/preview-links/links", () => ({
  resolvePreviewLinkByToken: resolvePreviewLinkByTokenMock,
}));

vi.mock("@/lib/posts/manage-posts", () => ({
  getAdminPostByIdOrSlug: getAdminPostByIdOrSlugMock,
}));

describe("/preview/[token] page gate", () => {
  afterEach(() => {
    setPreviewLinksEnabledForTests(undefined);
    notFoundMock.mockClear();
    resolvePreviewLinkByTokenMock.mockReset();
    getAdminPostByIdOrSlugMock.mockReset();
  });

  it("calls notFound when PREVIEW_LINKS_ENABLED is off", async () => {
    setPreviewLinksEnabledForTests(false);
    const { default: Page } = await import("./page");
    await expect(
      Page({ params: Promise.resolve({ token: "abc" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("exports noindex metadata and anti-cache headers", async () => {
    const { generateMetadata, headers } = await import("./page");
    const metadata = await generateMetadata();
    expect(metadata.robots).toEqual({ index: false, follow: false });
    await expect(headers()).resolves.toMatchObject({
      "Cache-Control": expect.stringContaining("no-store"),
      "X-Robots-Tag": "noindex, nofollow",
    });
  });
});
