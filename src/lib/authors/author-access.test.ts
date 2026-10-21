import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { setAuthorProfilesEnabledForTests } from "./feature-flag";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/payments/privy-linked-wallet", () => ({
  resolvePrivyLinkedChecksumWalletAddresses: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { resolvePrivyLinkedChecksumWalletAddresses } from "@/lib/payments/privy-linked-wallet";
import { requireAuthorProfileEditAccess } from "./author-access";

describe("requireAuthorProfileEditAccess", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    setAuthorProfilesEnabledForTests(true);
    const client = createClient({ url: ":memory:" });
    db = drizzle(client, { schema });
    await client.execute(`
      CREATE TABLE authors (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        slug text NOT NULL,
        bio text,
        avatar_url text,
        payout_address text NOT NULL,
        me_token_address text,
        me_token_symbol text,
        created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);
    await db.insert(schema.authors).values({
      id: "author-1",
      name: "Writer",
      slug: "writer",
      payoutAddress: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    });
    vi.stubEnv("PRIVY_ADMIN_USER_IDS", "");
  });

  afterEach(() => {
    setAuthorProfilesEnabledForTests(undefined);
    vi.unstubAllEnvs();
    vi.mocked(requirePrivyAuth).mockReset();
    vi.mocked(resolvePrivyLinkedChecksumWalletAddresses).mockReset();
  });

  it("returns 404 when author profiles are disabled", async () => {
    setAuthorProfilesEnabledForTests(false);
    const result = await requireAuthorProfileEditAccess(
      new Request("http://localhost"),
      db,
      "author-1",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
  });

  it("returns 403 when a non-owner tries to edit", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:stranger" },
    });
    vi.mocked(resolvePrivyLinkedChecksumWalletAddresses).mockResolvedValue([
      "0x1111111111111111111111111111111111111111",
    ]);

    const result = await requireAuthorProfileEditAccess(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token" },
      }),
      db,
      "author-1",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("allows owners whose linked wallet matches payout address", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:owner" },
    });
    vi.mocked(resolvePrivyLinkedChecksumWalletAddresses).mockResolvedValue([
      "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    ]);

    const result = await requireAuthorProfileEditAccess(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token" },
      }),
      db,
      "author-1",
    );
    expect(result.ok).toBe(true);
  });
});
