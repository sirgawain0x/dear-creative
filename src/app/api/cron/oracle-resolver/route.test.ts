import { afterEach, describe, expect, it, vi } from "vitest";
import { setOracleEnabledForTests } from "@/lib/predictions/feature-flag";
import { GET } from "./route";

vi.mock("@/db/client", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/adam/require-auth", () => ({
  requireAdamAuth: vi.fn().mockImplementation((req: Request) => {
    const auth = req.headers.get("authorization");
    if (auth === "Bearer test-adam-token") {
      return { ok: true, actor: "adam" };
    }
    return { ok: false };
  }),
}));

vi.mock("@/lib/predictions/oracle-resolver", () => ({
  resolvePendingPredictions: vi.fn().mockResolvedValue({
    totalPending: 1,
    finalizedCount: 1,
    results: [
      {
        id: "pred-1",
        questionId: "0x123",
        articleSlug: "test-slug",
        status: "finalized",
        outcome: "Yes",
      },
    ],
  }),
}));

describe("GET /api/cron/oracle-resolver", () => {
  afterEach(() => {
    setOracleEnabledForTests(undefined);
  });

  it("returns 503 when ORACLE_ENABLED is false", async () => {
    setOracleEnabledForTests(false);
    const req = new Request("http://localhost/api/cron/oracle-resolver", {
      headers: { authorization: "Bearer test-adam-token" },
    });
    const res = await GET(req);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("oracle_disabled");
  });

  it("rejects unauthorized calls", async () => {
    setOracleEnabledForTests(true);
    const req = new Request("http://localhost/api/cron/oracle-resolver");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("resolves predictions when authenticated with Bearer token", async () => {
    setOracleEnabledForTests(true);
    const req = new Request("http://localhost/api/cron/oracle-resolver", {
      headers: {
        authorization: "Bearer test-adam-token",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.report.finalizedCount).toBe(1);
    expect(body.report.results[0].status).toBe("finalized");
  });
});
