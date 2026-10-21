import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCowritersEnabledForTests } from "@/lib/cowriters/feature-flag";

const createCowriterInviteMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    inviteId: "inv-1",
    postWriterId: "pw-1",
    inviteUrl: "https://dear.example.test/cowriters/accept?token=abc",
    expiresAt: new Date(),
    matchedExistingWriter: false,
  }),
);

const getEditorWritersSnapshotMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ writers: [] }),
);

const getAdminPostByIdOrSlugMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    id: "post-1",
    slug: "post-1",
    title: "Post",
    status: "draft",
  }),
);

const requireStudioOrAdamAuthMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: true, actor: "admin@test" }),
);

vi.mock("@/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/lib/adam/studio-auth", () => ({
  requireStudioOrAdamAuth: requireStudioOrAdamAuthMock,
}));

vi.mock("@/lib/cowriters/invites", () => ({
  createCowriterInvite: createCowriterInviteMock,
}));

vi.mock("@/lib/cowriters/editor-writers", () => ({
  getEditorWritersSnapshot: getEditorWritersSnapshotMock,
}));

vi.mock("@/lib/posts/manage-posts", () => ({
  getAdminPostByIdOrSlug: getAdminPostByIdOrSlugMock,
}));

describe("POST /api/adam/posts/[postId]/writers/invites", () => {
  beforeEach(() => {
    setCowritersEnabledForTests(true);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dear.example.test");
    createCowriterInviteMock.mockClear();
    requireStudioOrAdamAuthMock.mockClear();
  });

  afterEach(() => {
    setCowritersEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("builds invite links from NEXT_PUBLIC_SITE_URL, not request Host", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://evil-scanner.example/api/adam/posts/post-1/writers/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "cowriter@example.com" }),
      }),
      { params: Promise.resolve({ postId: "post-1" }) },
    );

    expect(res.status).toBe(200);
    expect(createCowriterInviteMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        inviteBaseUrl: "https://dear.example.test",
      }),
    );
    const body = (await res.json()) as { invite: { inviteUrl: string } };
    expect(body.invite.inviteUrl).toMatch(/^https:\/\/dear\.example\.test\//);
    expect(body.invite.inviteUrl).not.toContain("evil-scanner");
  });
});
