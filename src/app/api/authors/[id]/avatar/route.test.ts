import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { setAuthorProfilesEnabledForTests } from "@/lib/authors/feature-flag";

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/authors/author-access", () => ({
  requireAuthorProfileEditAccess: vi.fn(),
}));

vi.mock("@/lib/storage/lens-grove", () => ({
  uploadToLensGrove: vi.fn(async () => ({
    uri: "lens://abc",
    gatewayUrl: "https://api.grove.storage/abc",
    storageKey: "abc",
  })),
}));

import { getDb } from "@/db/client";
import { requireAuthorProfileEditAccess } from "@/lib/authors/author-access";
import { POST } from "./route";

describe("POST /api/authors/[id]/avatar", () => {
  beforeEach(async () => {
    setAuthorProfilesEnabledForTests(true);
    const client = createClient({ url: ":memory:" });
    const db = drizzle(client, { schema });
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
      payoutAddress: "0x1",
    });
    vi.mocked(getDb).mockReturnValue(db);
  });

  afterEach(() => {
    setAuthorProfilesEnabledForTests(undefined);
    vi.mocked(requireAuthorProfileEditAccess).mockReset();
  });

  it("returns 404 when the feature flag is off", async () => {
    setAuthorProfilesEnabledForTests(false);
    const form = new FormData();
    form.set("file", new Blob(["x"], { type: "image/png" }), "a.png");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: form }),
      { params: Promise.resolve({ id: "author-1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-owners", async () => {
    vi.mocked(requireAuthorProfileEditAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const form = new FormData();
    form.set("file", new Blob(["x"], { type: "image/png" }), "a.png");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: form }),
      { params: Promise.resolve({ id: "author-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("validates upload mime type", async () => {
    vi.mocked(requireAuthorProfileEditAccess).mockResolvedValue({
      ok: true,
      privyUserId: "did:privy:admin",
      isAdmin: true,
    });
    const form = new FormData();
    form.set("file", new Blob(["x"], { type: "application/pdf" }), "a.pdf");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: form }),
      { params: Promise.resolve({ id: "author-1" }) },
    );
    expect(res.status).toBe(400);
  });
});
