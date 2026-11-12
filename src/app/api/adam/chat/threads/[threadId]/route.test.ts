import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteChatThreadMock = vi.hoisted(() => vi.fn());
const getChatThreadWithMessagesMock = vi.hoisted(() => vi.fn());
const updateChatThreadMock = vi.hoisted(() => vi.fn());
const requireStudioOrAdamAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/lib/adam/chat-history", () => ({
  deleteChatThread: deleteChatThreadMock,
  getChatThreadWithMessages: getChatThreadWithMessagesMock,
  updateChatThread: updateChatThreadMock,
}));

vi.mock("@/lib/adam/studio-auth", () => ({
  requireStudioOrAdamAuth: requireStudioOrAdamAuthMock,
}));

describe("DELETE /api/adam/chat/threads/[threadId]", () => {
  beforeEach(() => {
    deleteChatThreadMock.mockReset();
    requireStudioOrAdamAuthMock.mockReset();
  });

  it("requires studio auth", async () => {
    requireStudioOrAdamAuthMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request("https://example.test/api/adam/chat/threads/t1"), {
      params: Promise.resolve({ threadId: "t1" }),
    });

    expect(res.status).toBe(401);
    expect(deleteChatThreadMock).not.toHaveBeenCalled();
  });

  it("passes caller access into deleteChatThread", async () => {
    requireStudioOrAdamAuthMock.mockResolvedValue({
      ok: true,
      actor: "did:privy:user-a",
      mode: "privy_admin",
    });
    deleteChatThreadMock.mockResolvedValue(true);

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request("https://example.test/api/adam/chat/threads/t1"), {
      params: Promise.resolve({ threadId: "t1" }),
    });

    expect(res.status).toBe(200);
    expect(deleteChatThreadMock).toHaveBeenCalledWith(expect.anything(), "t1", {
      actor: "did:privy:user-a",
      mode: "privy_admin",
    });
  });

  it("returns 404 when deleteChatThread rejects cross-user access", async () => {
    requireStudioOrAdamAuthMock.mockResolvedValue({
      ok: true,
      actor: "did:privy:user-a",
      mode: "privy_admin",
    });
    deleteChatThreadMock.mockResolvedValue(false);

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request("https://example.test/api/adam/chat/threads/t-owned-by-b"), {
      params: Promise.resolve({ threadId: "t-owned-by-b" }),
    });

    expect(res.status).toBe(404);
  });
});
