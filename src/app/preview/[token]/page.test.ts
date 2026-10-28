import { afterEach, describe, expect, it, vi } from "vitest";
import { setPreviewLinksEnabledForTests } from "@/lib/preview-links/feature-flag";

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);
const resolvePreviewLinkByTokenMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: false, reason: "invalid" }),
);
const getAdminPostByIdOrSlugMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
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
    redirectMock.mockClear();
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

  it("exports noindex metadata", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("redirects to the public post when the target is published", async () => {
    setPreviewLinksEnabledForTests(true);
    resolvePreviewLinkByTokenMock.mockResolvedValue({
      ok: true,
      postId: "post-published",
      linkId: "link-1",
    });
    getAdminPostByIdOrSlugMock.mockResolvedValue({
      id: "post-published",
      slug: "already-live",
      title: "Live",
      status: "published",
      teaserText: null,
      bodyHtml: "<p>Hi</p>",
      isGated: false,
      freeContent: null,
      gatedContent: null,
    });

    const { default: Page } = await import("./page");
    await expect(
      Page({ params: Promise.resolve({ token: "valid-token" }) }),
    ).rejects.toThrow("REDIRECT:/posts/already-live");
    expect(redirectMock).toHaveBeenCalledWith("/posts/already-live");
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
