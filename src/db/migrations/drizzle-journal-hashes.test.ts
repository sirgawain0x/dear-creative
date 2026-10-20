import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

/** Matches drizzle-orm/migrator.js readMigrationFiles (sha256 of full .sql file text). */
function hashMigrationSqlFile(tag: string): string {
  const query = readFileSync(join(process.cwd(), "drizzle", `${tag}.sql`)).toString();
  return createHash("sha256").update(query).digest("hex");
}

const RECONCILE_0009_TO_0014 = [
  {
    tag: "0009_adam_studio",
    when: 1792360000000,
    hash: "1d6d953d16de0b701e8816e91fe263366730eea64893d18e0ec4c3862ec9b6e1",
  },
  {
    tag: "0010_post_feedback",
    when: 1792440000000,
    hash: "21ff63d7a6971402cdd58eed3f617dc3f0ff7e0a76b2901f1e6e3d662bd5f9f4",
  },
  {
    tag: "0011_adam_chat_history",
    when: 1792445000000,
    hash: "3c4399b8c2e20c22e31e2c94a3e1cea6f213174bfc938c82358f61a06f8d810d",
  },
  {
    tag: "0012_supreme_living_lightning",
    when: 1792446815673,
    hash: "2eb9c6825c8aed2539990627e752070f4820a1168b5deeca8be091023c34e99a",
  },
  {
    tag: "0013_quiet_arclight",
    when: 1792459720133,
    hash: "bb30fa16fd29e15a1c327f1f2d6003e444fdf20531bfd4d66148c99dfd24de81",
  },
  {
    tag: "0014_glossy_franklin_storm",
    when: 1792470579682,
    hash: "a924428ddde0acd4ce743cd6ecd01d2a9c06a48f91e232d6a16fe05981001539",
  },
] as const;

describe("drizzle journal reconciliation hashes (0009–0014)", () => {
  it("matches drizzle-orm readMigrationFiles hash algorithm", () => {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    for (const expected of RECONCILE_0009_TO_0014) {
      const fromLib = migrations.find((m) => m.folderMillis === expected.when);
      expect(fromLib?.hash).toBe(expected.hash);
      expect(hashMigrationSqlFile(expected.tag)).toBe(expected.hash);
    }
  });
});
