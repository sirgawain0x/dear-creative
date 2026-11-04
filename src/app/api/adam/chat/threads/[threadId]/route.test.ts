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

  it("deletes an existing thread for an authenticated caller", async () => {
    requireStudioOrAdamAuthMock.mockResolvedValue({
      ok: true,
      actor: "user-a",
      mode: "privy_admin",
    });
    deleteChatThreadMock.mockResolvedValue(true);

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request("https://example.test/api/adam/chat/threads/t1"), {
      params: Promise.resolve({ threadId: "t1" }),
    });

    expect(res.status).toBe(200);
    expect(deleteChatThreadMock).toHaveBeenCalledWith(expect.anything(), "t1");
  });

  /**
   * Per-user delete isolation needs `owner_user_id` on adam_chat_threads (set on create
   * from requireStudioOrAdamAuth actor, enforced in GET/PATCH/DELETE/list).
   */
  it.skip("rejects delete when the thread belongs to another user (needs owner_user_id column)", () => {
    expect(true).toBe(true);
  });
});
