import { afterEach, describe, expect, it, vi } from "vitest";
import { setPaywallEnabledForTests } from "@/lib/paywall/feature-flag";
import { POST } from "./route";

describe("POST /api/paywall/reader/unlock", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
  });

  it("returns 404 when PAYWALL_ENABLED is off", async () => {
    setPaywallEnabledForTests(false);
    const res = await POST(
      new Request("http://localhost/api/paywall/reader/unlock", {
        method: "POST",
        body: JSON.stringify({ slug: "x", txHash: "0x" + "a".repeat(64) }),
      }),
    );
    expect(res.status).toBe(404);
  });
});
