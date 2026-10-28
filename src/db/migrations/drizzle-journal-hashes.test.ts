import { existsSync, readFileSync } from "node:fs";
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

const RECONCILE_0016 = {
  tag: "0016_post_repurpose_outputs",
  when: 1792521000000,
  hash: "800c8fa9e28740b64dae4b7cd549b086b310a97f032135c32e759df768989d8b",
} as const;

const RECONCILE_0017 = {
  tag: "0017_backfill_null_post_author_g2",
  when: 1792522000000,
  hash: "4a75cd5194d7d0746bf52e9f0f56edb2430700044f545f793f148f0a6bbe886f",
} as const;

const RECONCILE_0018 = {
  tag: "0018_linkedin_member_credentials",
  when: 1792523000000,
  hash: "ac80efa6c47c09486194cd8cb34fabefcb3e4c1980bd3a1f0e9ad4087360adea",
} as const;

const RECONCILE_0019 = {
  tag: "0019_earn_audit_log",
  when: 1792524500000,
  hash: "41ea9b3e0cf2e58708029b86ea94db760825339fab931ec89d06c756e4186c74",
} as const;

const RECONCILE_0020 = {
  tag: "0020_reader_post_unlock_purchases",
  when: 1792525000000,
  hash: "23b478d97996876599ad685b9d55d04267d30fe3da4c26646772b70388b50ad4",
} as const;

const RECONCILE_0021 = {
  tag: "0021_cowriters",
  when: 1792602394384,
  hash: "83a8d452b6e3a89111c9ad2e2118063a49c035971255a7b7db99a5e5ce76df86",
} as const;

const RECONCILE_0022 = {
  tag: "0022_beehiiv_import",
  when: 1792605000000,
  hash: "3aca3aec5016c01bbc544c852688de9516a1b3d50757d47893da71b5bdbb54e2",
} as const;

const RECONCILE_0023 = {
  tag: "0023_post_preview_links",
  when: 1792610000000,
  hash: "12a92b926ad104067ad6330ff24e5572907dd16dee61149acd2d367713b980c5",
} as const;

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

describe("drizzle journal reconciliation hashes (0016 repurpose)", () => {
  it("matches drizzle-orm readMigrationFiles hash algorithm", () => {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const fromLib = migrations.find((m) => m.folderMillis === RECONCILE_0016.when);
    expect(fromLib?.hash).toBe(RECONCILE_0016.hash);
    expect(hashMigrationSqlFile(RECONCILE_0016.tag)).toBe(RECONCILE_0016.hash);
  });

  it("tolerates a gap at migration tag 0015 (journal idx 15 → 0016 sql)", () => {
    expect(existsSync(join(process.cwd(), "drizzle", "0015_cowriters.sql"))).toBe(
      false,
    );
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string }> };
    const repurposeEntry = journal.entries.find(
      (entry) => entry.tag === RECONCILE_0016.tag,
    );
    expect(repurposeEntry?.idx).toBe(15);
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    expect(migrations.some((m) => m.folderMillis === RECONCILE_0016.when)).toBe(
      true,
    );
  });
});

describe("drizzle journal reconciliation hashes (0017 null author backfill)", () => {
  it("matches drizzle-orm readMigrationFiles hash algorithm", () => {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const fromLib = migrations.find((m) => m.folderMillis === RECONCILE_0017.when);
    expect(fromLib?.hash).toBe(RECONCILE_0017.hash);
    expect(hashMigrationSqlFile(RECONCILE_0017.tag)).toBe(RECONCILE_0017.hash);
  });

  it("registers 0017 at journal idx 16 after 0016", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(journal.entries.length).toBeGreaterThanOrEqual(17);
    const backfillEntry = journal.entries.find(
      (entry) => entry.tag === RECONCILE_0017.tag,
    );
    expect(backfillEntry?.idx).toBe(16);
    expect(backfillEntry?.when).toBeGreaterThan(RECONCILE_0016.when);
  });
});

describe("drizzle journal reconciliation hashes (0019 earn audit log)", () => {
  it("matches drizzle-orm readMigrationFiles hash algorithm", () => {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const fromLib = migrations.find((m) => m.folderMillis === RECONCILE_0019.when);
    expect(fromLib?.hash).toBe(RECONCILE_0019.hash);
    expect(hashMigrationSqlFile(RECONCILE_0019.tag)).toBe(RECONCILE_0019.hash);
  });

  it("registers 0019 at journal idx 18 after 0018", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const entry = journal.entries.find(
      (row) => row.tag === RECONCILE_0019.tag,
    );
    expect(entry?.idx).toBe(18);
    expect(entry?.when).toBeGreaterThan(RECONCILE_0018.when);
  });
});

describe("drizzle journal reconciliation hashes (0020 reader post unlock)", () => {
  it("matches drizzle-orm readMigrationFiles hash algorithm", () => {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const fromLib = migrations.find((m) => m.folderMillis === RECONCILE_0020.when);
    expect(fromLib?.hash).toBe(RECONCILE_0020.hash);
    expect(hashMigrationSqlFile(RECONCILE_0020.tag)).toBe(RECONCILE_0020.hash);
  });

  it("registers 0020 at journal idx 19 after 0019", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const entry = journal.entries.find(
      (row) => row.tag === RECONCILE_0020.tag,
    );
    expect(entry?.idx).toBe(19);
    expect(entry?.when).toBeGreaterThan(RECONCILE_0019.when);
  });
});

describe("drizzle journal reconciliation hashes (0018 linkedin credentials)", () => {
  it("matches drizzle-orm readMigrationFiles hash algorithm", () => {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const fromLib = migrations.find((m) => m.folderMillis === RECONCILE_0018.when);
    expect(fromLib?.hash).toBe(RECONCILE_0018.hash);
    expect(hashMigrationSqlFile(RECONCILE_0018.tag)).toBe(RECONCILE_0018.hash);
  });

  it("registers 0018 at journal idx 17 after 0017", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const linkedinEntry = journal.entries.find(
      (entry) => entry.tag === RECONCILE_0018.tag,
    );
    expect(linkedinEntry?.idx).toBe(17);
    expect(linkedinEntry?.when).toBeGreaterThan(RECONCILE_0017.when);
  });
});

describe("drizzle journal reconciliation hashes (0021 cowriters)", () => {
  it("matches drizzle-orm readMigrationFiles hash algorithm", () => {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const fromLib = migrations.find((m) => m.folderMillis === RECONCILE_0021.when);
    expect(fromLib?.hash).toBe(RECONCILE_0021.hash);
    expect(hashMigrationSqlFile(RECONCILE_0021.tag)).toBe(RECONCILE_0021.hash);
  });

  it("registers 0021 at journal idx 20 after 0020", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const entry = journal.entries.find((row) => row.tag === RECONCILE_0021.tag);
    expect(entry?.idx).toBe(20);
    expect(entry?.when).toBeGreaterThan(RECONCILE_0020.when);
  });
});

describe("drizzle journal reconciliation hashes (0022 beehiiv import)", () => {
  it("matches drizzle-orm readMigrationFiles hash algorithm", () => {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const fromLib = migrations.find((m) => m.folderMillis === RECONCILE_0022.when);
    expect(fromLib?.hash).toBe(RECONCILE_0022.hash);
    expect(hashMigrationSqlFile(RECONCILE_0022.tag)).toBe(RECONCILE_0022.hash);
  });

  it("registers 0022 at journal idx 21 after 0021", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const entry = journal.entries.find((row) => row.tag === RECONCILE_0022.tag);
    expect(entry?.idx).toBe(21);
    expect(entry?.when).toBeGreaterThan(RECONCILE_0021.when);
  });
});

describe("drizzle journal reconciliation hashes (0023 post preview links)", () => {
  it("matches drizzle-orm readMigrationFiles hash algorithm", () => {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const fromLib = migrations.find((m) => m.folderMillis === RECONCILE_0023.when);
    expect(fromLib?.hash).toBe(RECONCILE_0023.hash);
    expect(hashMigrationSqlFile(RECONCILE_0023.tag)).toBe(RECONCILE_0023.hash);
  });

  it("registers 0023 at journal idx 22 after 0022", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const entry = journal.entries.find((row) => row.tag === RECONCILE_0023.tag);
    expect(entry?.idx).toBe(22);
    expect(entry?.when).toBeGreaterThan(RECONCILE_0022.when);
  });
});
