import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { postWriters } from "@/db/schema";

const drizzleDir = join(process.cwd(), "drizzle");
const journal = JSON.parse(
  readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8"),
) as { entries: { tag: string }[] };

function splitMigrationStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

async function migrateThroughTag(exclusiveEndTag: string) {
  const client = createClient({ url: ":memory:" });
  const db = drizzle({ client, schema });

  for (const entry of journal.entries) {
    if (entry.tag === exclusiveEndTag) {
      break;
    }
    const sql = readFileSync(join(drizzleDir, `${entry.tag}.sql`), "utf8");
    for (const statement of splitMigrationStatements(sql)) {
      await client.execute(statement);
    }
  }

  return { client, db };
}

describe("0015_cowriters migration", () => {
  it("applies on in-memory libsql and backfills author rows", async () => {
    const { client, db } = await migrateThroughTag("0015_cowriters");

    await client.execute({
      sql: `INSERT INTO posts (id, slug, title, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, unixepoch() * 1000, unixepoch() * 1000)`,
      args: ["post-1", "alpha", "Alpha", "draft"],
    });
    await client.execute({
      sql: `INSERT INTO authors (id, name, slug, payout_address, created_at, updated_at)
            VALUES (?, ?, ?, ?, unixepoch() * 1000, unixepoch() * 1000)`,
      args: [
        "author-1",
        "Primary Author",
        "primary-author",
        "0x1111111111111111111111111111111111111111",
      ],
    });
    await client.execute({
      sql: `INSERT INTO posts (id, slug, title, status, author_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, unixepoch() * 1000, unixepoch() * 1000)`,
      args: ["post-2", "beta", "Beta", "published", "author-1"],
    });

    const migrationSql = readFileSync(
      join(drizzleDir, "0015_cowriters.sql"),
      "utf8",
    );
    for (const statement of splitMigrationStatements(migrationSql)) {
      await client.execute(statement);
    }

    const rows = await db.select().from(postWriters);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "author:post-1",
          postId: "post-1",
          role: "author",
          shareBps: 10_000,
          status: "accepted",
          writerId: null,
          inviteId: null,
        }),
        expect.objectContaining({
          id: "author:post-2",
          postId: "post-2",
          role: "author",
          shareBps: 10_000,
          status: "accepted",
          writerId: "author-1",
        }),
      ]),
    );

    client.close();
  });

  it("runs with the full migrator on :memory:", async () => {
    const client = createClient({ url: ":memory:" });
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    client.close();
  });
});
