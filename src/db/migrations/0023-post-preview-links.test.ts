import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";

const drizzleDir = join(process.cwd(), "drizzle");

function splitMigrationStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

describe("0023_post_preview_links migration", () => {
  it("creates post_preview_links with token hash index", async () => {
    const client = createClient({ url: ":memory:" });
    await client.execute(`
      CREATE TABLE posts (
        id text PRIMARY KEY NOT NULL,
        slug text NOT NULL,
        title text NOT NULL,
        status text NOT NULL,
        created_at integer NOT NULL,
        updated_at integer NOT NULL
      )
    `);

    const migrationSql = readFileSync(
      join(drizzleDir, "0023_post_preview_links.sql"),
      "utf8",
    );
    for (const statement of splitMigrationStatements(migrationSql)) {
      await client.execute(statement);
    }

    const tableInfo = await client.execute("PRAGMA table_info(post_preview_links)");
    const columns = tableInfo.rows.map((row) => row.name);
    expect(columns).toContain("token_hash");
    expect(columns).toContain("revoked_at");

    const indexes = await client.execute("PRAGMA index_list(post_preview_links)");
    const indexNames = indexes.rows.map((row) => row.name);
    expect(indexNames.some((name) => String(name).includes("token_hash"))).toBe(
      true,
    );
  });

  it("stores only hashed tokens in SQL", () => {
    const sql = readFileSync(
      join(drizzleDir, "0023_post_preview_links.sql"),
      "utf8",
    );
    expect(sql).toContain("token_hash");
    expect(sql).not.toMatch(/\btoken\b(?!_hash)/);
    expect(sql.toLowerCase()).toContain("on delete cascade");
  });

  it("cascades link deletion when a post is deleted", async () => {
    const client = createClient({ url: ":memory:" });
    await client.execute(`
      CREATE TABLE posts (
        id text PRIMARY KEY NOT NULL,
        slug text NOT NULL,
        title text NOT NULL,
        status text NOT NULL,
        created_at integer NOT NULL,
        updated_at integer NOT NULL
      )
    `);
    const migrationSql = readFileSync(
      join(drizzleDir, "0023_post_preview_links.sql"),
      "utf8",
    );
    for (const statement of splitMigrationStatements(migrationSql)) {
      await client.execute(statement);
    }
    await client.execute({
      sql: `INSERT INTO posts (id, slug, title, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, unixepoch() * 1000, unixepoch() * 1000)`,
      args: ["post-1", "draft", "Draft", "draft"],
    });
    await client.execute({
      sql: `INSERT INTO post_preview_links
        (id, post_id, token_hash, expires_at, created_by, created_at)
        VALUES (?, ?, ?, unixepoch() * 1000 + 86400000, ?, unixepoch() * 1000)`,
      args: ["link-1", "post-1", "abc123", "did:privy:writer"],
    });
    await client.execute(`DELETE FROM posts WHERE id = 'post-1'`);
    const remaining = await client.execute(
      `SELECT COUNT(*) AS count FROM post_preview_links`,
    );
    expect(Number(remaining.rows[0]?.count)).toBe(0);
  });
});
