import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { getAuthorProfileById, updateAuthorDisplayProfile } from "./author-profile";

describe("updateAuthorDisplayProfile", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    const client = createClient({ url: ":memory:" });
    db = drizzle(client, { schema });
    await client.execute(`
      CREATE TABLE authors (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        slug text NOT NULL,
        bio text,
        tagline text,
        avatar_url text,
        payout_address text NOT NULL,
        me_token_address text,
        me_token_symbol text,
        created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);
    await db.insert(schema.authors).values({
      id: "g2",
      name: "G2",
      slug: "g2",
      payoutAddress: "0x1",
    });
  });

  it("persists tagline and display name updates", async () => {
    const tagline =
      "Music producer and builder helping creators own their work and their audience.";
    const result = await updateAuthorDisplayProfile(db, "g2", {
      name: " G2 ",
      tagline,
    });
    expect(result).toEqual({ ok: true });

    const profile = await getAuthorProfileById(db, "g2");
    expect(profile?.name).toBe("G2");
    expect(profile?.tagline).toBe(tagline);
  });
});
