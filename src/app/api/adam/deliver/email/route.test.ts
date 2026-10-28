import { afterEach, describe, expect, it, vi } from "vitest";

const sendNewsletterEmail = vi.fn();

vi.mock("@/lib/adam/deliver-email", () => ({
  sendNewsletterEmail,
}));

vi.mock("@/lib/adam/require-auth", () => ({
  requireAdamAuth: () => ({ ok: true as const }),
}));

vi.mock("@/db/client", () => ({
  getDb: () => ({}),
}));

describe("POST /api/adam/deliver/email", () => {
  afterEach(() => {
    sendNewsletterEmail.mockReset();
  });

  it("forwards repurposeIncludes to sendNewsletterEmail", async () => {
    sendNewsletterEmail.mockResolvedValue({
      outcome: "sent",
      broadcastId: "dry-run",
      dryRun: true,
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/adam/deliver/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: "p1",
          idempotencyKey: "key-1",
          dryRun: true,
          repurposeIncludes: ["mind_map", "flashcards"],
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(sendNewsletterEmail).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        postId: "p1",
        repurposeIncludes: ["mind_map", "flashcards"],
      }),
    );
  });
});
