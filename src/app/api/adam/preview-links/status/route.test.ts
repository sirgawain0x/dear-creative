import { afterEach, describe, expect, it, vi } from "vitest";
import { setPreviewLinksEnabledForTests } from "@/lib/preview-links/feature-flag";

const requireStudioOrAdamAuthMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: true, actor: "did:privy:admin", mode: "privy_admin" }),
);

vi.mock("@/lib/adam/studio-auth", () => ({
  requireStudioOrAdamAuth: requireStudioOrAdamAuthMock,
}));

describe("GET /api/adam/preview-links/status", () => {
  afterEach(() => {
    setPreviewLinksEnabledForTests(undefined);
    requireStudioOrAdamAuthMock.mockReset();
    requireStudioOrAdamAuthMock.mockResolvedValue({
      ok: true,
      actor: "did:privy:admin",
      mode: "privy_admin",
    });
  });

  it("returns 404 when the feature flag is off", async () => {
    setPreviewLinksEnabledForTests(false);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost"));
    expect(res.status).toBe(404);
  });

  it("requires studio auth", async () => {
    setPreviewLinksEnabledForTests(true);
    requireStudioOrAdamAuthMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost"));
    expect(res.status).toBe(401);
  });

  it("returns enabled=true when the flag is on", async () => {
    setPreviewLinksEnabledForTests(true);
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer test" },
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ enabled: true });
  });
});
