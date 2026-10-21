import { afterEach, describe, expect, it, vi } from "vitest";
import { setPaywallEnabledForTests } from "@/lib/paywall/feature-flag";

vi.mock("@/db/client", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/lib/paywall/reader-checkout-service", () => ({
  loadReaderPostUnlockContext: vi.fn(async () => null),
}));

import { GET } from "./route";

describe("GET /api/paywall/reader/context", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("returns 404 when paywall flag combo is off", async () => {
    setPaywallEnabledForTests(false);
    const res = await GET(
      new Request("http://localhost/api/paywall/reader/context?slug=x"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when PAYWALL_ENABLED is true but PAYMENTS_ENABLED is not", async () => {
    vi.stubEnv("PAYWALL_ENABLED", "true");
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    setPaywallEnabledForTests(undefined);
    const res = await GET(
      new Request("http://localhost/api/paywall/reader/context?slug=x"),
    );
    expect(res.status).toBe(404);
  });
});
