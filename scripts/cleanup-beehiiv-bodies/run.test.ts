import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import { posts } from "../../src/db/schema";
import { runBeehiivBodyCleanupFromDb } from "./run";

async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "beehiiv-cleanup-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

describe("runBeehiivBodyCleanupFromDb", () => {
  it("only updates beehiiv sourceGuid posts and only bodyHtml on live", async () => {
    const db = await createTestDb();
    await db.insert(posts).values([
      {
        id: "beehiiv-1",
        slug: "july-24",
        title: "July",
        status: "published",
        sourceGuid: "beehiiv:abc",
        canonicalUrl: "https://dearcrtv.beehiiv.com/p/july-24",
        bodyHtml:
          '<a href="https://dearcrtv.beehiiv.com/p/july-24?utm_source=x">x</a>',
        emailSubject: "Keep subject",
      },
      {
        id: "other-1",
        slug: "native",
        title: "Native",
        status: "published",
        bodyHtml:
          '<a href="https://dearcrtv.beehiiv.com/p/july-24?utm_source=x">x</a>',
      },
    ]);

    const dry = await runBeehiivBodyCleanupFromDb({
      db,
      live: false,
      prod: false,
      databaseHost: "file:local",
    });
    expect(dry.postsProcessed).toBe(1);
    expect(dry.posts[0]?.counts.linksRewritten).toBe(1);

    await runBeehiivBodyCleanupFromDb({
      db,
      live: true,
      prod: false,
      databaseHost: "file:local",
    });

    const beehiivRow = await db.query.posts.findFirst({
      where: (table, { eq: eqFn }) => eqFn(table.id, "beehiiv-1"),
    });
    const otherRow = await db.query.posts.findFirst({
      where: (table, { eq: eqFn }) => eqFn(table.id, "other-1"),
    });
    expect(beehiivRow?.bodyHtml).toContain('/posts/july-24"');
    expect(beehiivRow?.emailSubject).toBe("Keep subject");
    expect(otherRow?.bodyHtml).toContain("utm_source");
  });
});
