import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setPreviewLinksEnabledForTests } from "@/lib/preview-links/feature-flag";

const canManageMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const createPostPreviewLinkMock = vi.hoisted(() => vi.fn());
const getAdminPostByIdOrSlugMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    id: "post-1",
    slug: "post-1",
    title: "Draft",
    status: "draft",
  }),
);

vi.mock("@/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/lib/adam/studio-auth", () => ({
  requireStudioOrAdamAuth: vi.fn().mockResolvedValue({
    ok: true,
    actor: "did:privy:admin",
    mode: "privy_admin",
  }),
}));

vi.mock("@/lib/preview-links/manage-access", () => ({
  requirePostPreviewLinkManageAccess: vi.fn(async () => {
    const allowed = await canManageMock();
    if (!allowed) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  }),
}));

vi.mock("@/lib/preview-links/links", () => ({
  createPostPreviewLink: createPostPreviewLinkMock,
  listActivePostPreviewLinks: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/posts/manage-posts", () => ({
  getAdminPostByIdOrSlug: getAdminPostByIdOrSlugMock,
}));

describe("/api/adam/posts/[postId]/preview-links", () => {
  beforeEach(() => {
    setPreviewLinksEnabledForTests(true);
    canManageMock.mockResolvedValue(true);
    getAdminPostByIdOrSlugMock.mockResolvedValue({
      id: "post-1",
      slug: "post-1",
      title: "Draft",
      status: "draft",
    });
    createPostPreviewLinkMock.mockReset();
    createPostPreviewLinkMock.mockResolvedValue({
      linkId: "link-1",
      previewUrl: "https://dear.example.test/preview/tok",
      expiresAt: new Date(),
    });
  });

  afterEach(() => {
    setPreviewLinksEnabledForTests(undefined);
  });

  it("returns 404 when the feature flag is off", async () => {
    setPreviewLinksEnabledForTests(false);
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ postId: "post-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 when the post is already published", async () => {
    getAdminPostByIdOrSlugMock.mockResolvedValue({
      id: "post-live",
      slug: "already-live",
      title: "Live",
      status: "published",
    });
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ postId: "post-live" }),
    });
    expect(res.status).toBe(409);
    expect(createPostPreviewLinkMock).not.toHaveBeenCalled();
  });

  it("returns 403 when caller cannot manage the post", async () => {
    canManageMock.mockResolvedValue(false);
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ postId: "post-1" }),
    });
    expect(res.status).toBe(403);
  });
});
