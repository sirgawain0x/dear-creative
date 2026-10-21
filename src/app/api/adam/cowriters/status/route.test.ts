import { afterEach, describe, expect, it, vi } from "vitest";
import { setCowritersEnabledForTests } from "@/lib/cowriters/feature-flag";
import { GET } from "./route";

describe("GET /api/adam/cowriters/status", () => {
  afterEach(() => {
    setCowritersEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("returns 404 when co-writers are disabled", async () => {
    setCowritersEnabledForTests(false);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns enabled=true when the flag is on", async () => {
    setCowritersEnabledForTests(true);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ enabled: true });
  });
});
