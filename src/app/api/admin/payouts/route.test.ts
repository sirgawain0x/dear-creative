import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import * as schema from "@/db/schema";
import { writers } from "@/db/schema";
import { getAddress } from "viem";
import {
  resetPrivyLinkedChecksumAddressesResolverForTests,
  setPrivyLinkedChecksumAddressesResolverForTests,
} from "@/lib/payments/privy-linked-wallet";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { GET } from "./route";

let testDb: ReturnType<typeof drizzle>;

vi.mock("@/db/client", () => ({
  getDb: () => testDb,
}));

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "dear-admin-payouts-route-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

const WRITER_WALLET = "0x1111111111111111111111111111111111111111";
const OTHER_WALLET = "0x3333333333333333333333333333333333333333";

describe("GET /api/admin/payouts", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    vi.stubEnv(
      "DEAR_PLATFORM_TREASURY_ADDRESS",
      "0xf46f1ba19a9280f752a451d0973b047d81c63d70",
    );
    vi.mocked(requirePrivyAuth).mockReset();
    resetPrivyLinkedChecksumAddressesResolverForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetPrivyLinkedChecksumAddressesResolverForTests();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(
      new Request("http://localhost/api/admin/payouts"),
    );
    expect(response.status).toBe(401);
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
  });

  it("returns 403 for non-admin users", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET(
      new Request("http://localhost/api/admin/payouts", {
        headers: { Authorization: "Bearer user-token" },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects adam/studio service token (privy admin only)", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(
      new Request("http://localhost/api/admin/payouts", {
        headers: { Authorization: "Bearer adam-api-token" },
      }),
    );
    expect(response.status).toBe(401);
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
  });

  it("returns checksummed payout snapshot for privy admin with matching linked wallet", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });

    setPrivyLinkedChecksumAddressesResolverForTests(async () => [
      getAddress(WRITER_WALLET),
    ]);

    await testDb.insert(writers).values({
      id: randomUUID(),
      payoutWalletAddress: WRITER_WALLET,
      payoutSplitAddress: "0x2222222222222222222222222222222222222222",
    });

    const response = await GET(
      new Request("http://localhost/api/admin/payouts", {
        headers: { Authorization: "Bearer admin-token" },
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      payoutWalletAddress: string;
      treasuryAddress: string;
    };
    expect(body.payoutWalletAddress).toBe(getAddress(WRITER_WALLET));
    expect(body.treasuryAddress).toBe(
      "0xf46F1BA19A9280F752a451d0973b047D81c63D70",
    );
  });

  it("returns null writer fields when linked wallet does not match any writer", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });

    setPrivyLinkedChecksumAddressesResolverForTests(async () => [
      getAddress(OTHER_WALLET),
    ]);

    await testDb.insert(writers).values({
      id: randomUUID(),
      payoutWalletAddress: WRITER_WALLET,
      payoutSplitAddress: "0x2222222222222222222222222222222222222222",
    });

    const response = await GET(
      new Request("http://localhost/api/admin/payouts", {
        headers: { Authorization: "Bearer admin-token" },
      }),
    );

    const body = (await response.json()) as {
      payoutWalletAddress: string | null;
      payoutSplitAddress: string | null;
      treasuryAddress: string;
    };
    expect(body.payoutWalletAddress).toBeNull();
    expect(body.payoutSplitAddress).toBeNull();
    expect(body.treasuryAddress).toBeTruthy();
  });

  it("does not expose mutation handlers", async () => {
    const routeModule = await import("./route");
    expect(Object.keys(routeModule).sort()).toEqual(["GET"]);
  });
});
