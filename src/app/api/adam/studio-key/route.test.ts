import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADAM_STUDIO_KEY_COOKIE } from "@/lib/adam/studio-access";
import { POST } from "./route";

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

function post(body: unknown): Request {
  return new Request("http://localhost/api/adam/studio-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/adam/studio-key", () => {
  beforeEach(() => {
    vi.stubEnv("ADAM_API_TOKEN", "studio-secret");
    mockCookieStore.set.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(post("{not-json"));
    expect(response.status).toBe(400);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it("rejects a wrong key", async () => {
    const response = await POST(post({ token: "nope" }));
    expect(response.status).toBe(401);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it("rejects when ADAM_API_TOKEN is not configured", async () => {
    vi.stubEnv("ADAM_API_TOKEN", "");
    const response = await POST(post({ token: "" }));
    expect(response.status).toBe(401);
  });

  it("sets an httpOnly cookie for the correct key", async () => {
    const response = await POST(post({ token: "  studio-secret  " }));
    expect(response.status).toBe(200);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      ADAM_STUDIO_KEY_COOKIE,
      "studio-secret",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  });
});
