import { afterEach, describe, expect, it, vi } from "vitest";
import { adminConfigResponse, GET } from "./route";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn(async () => {}),
  };
});

import { connection } from "next/server";

describe("/api/admin/config route segment config", () => {
  it("opts into request-time rendering via connection() (no ISR revalidate)", async () => {
    const routeModule = await import("./route");
    expect(routeModule).not.toHaveProperty("revalidate");
    expect(routeModule).not.toHaveProperty("dynamic");
    await GET();
    expect(connection).toHaveBeenCalled();
  });
});

describe("adminConfigResponse", () => {
  it("sets Cache-Control private, no-store", () => {
    const res = adminConfigResponse({ ok: true });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sets Cache-Control on error responses", () => {
    const res = adminConfigResponse({ error: "x" }, { status: 500 });
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("GET /api/admin/config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(connection).mockClear();
  });

  it("returns JSON with private no-store cache control", async () => {
    vi.stubEnv("WALLET_ENABLED", "true");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const json = (await res.json()) as { walletEnabled?: boolean };
    expect(typeof json.walletEnabled).toBe("boolean");
    expect(connection).toHaveBeenCalled();
  });
});
