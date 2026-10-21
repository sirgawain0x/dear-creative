import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { describe, expect, it, afterEach } from "vitest";
import * as schema from "@/db/schema";
import { authors, posts } from "@/db/schema";

const BACKFILL_JOURNAL_WHEN = 1792522000000;
const LINKEDIN_JOURNAL_WHEN = 1792523000000;
const READER_CHECKOUT_JOURNAL_WHEN = 1792524000000;

function createMigrationsFolderThrough0016(): string {
  const dir = mkdtempSync(join(tmpdir(), "dear-drizzle-through-0016-"));
  cpSync(join(process.cwd(), "drizzle"), dir, { recursive: true });
  rmSync(join(dir, "0017_backfill_null_post_author_g2.sql"));
  rmSync(join(dir, "0018_linkedin_member_credentials.sql"));
  rmSync(join(dir, "0019_reader_checkout_records.sql"));
  rmSync(join(dir, "meta/0017_snapshot.json"));
  const journalPath = join(dir, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: Array<{ when: number }>;
  };
  journal.entries = journal.entries.filter(
    (entry) =>
      entry.when !== BACKFILL_JOURNAL_WHEN &&
      entry.when !== LINKEDIN_JOURNAL_WHEN &&
      entry.when !== READER_CHECKOUT_JOURNAL_WHEN,
  );
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
  return dir;
}

async function seedBackfillFixtures(db: ReturnType<typeof drizzle>) {
  await db.insert(authors).values([
    {
      id: "g2",
      name: "G2",
      slug: "g2",
      payoutAddress: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    },
    {
      id: "other-author",
      name: "Other",
      slug: "other-author",
      payoutAddress: "0x1111111111111111111111111111111111111111",
    },
  ]);

  const nullAuthorPostId = randomUUID();
  const assignedPostId = randomUUID();
  await db.insert(posts).values([
    {
      id: nullAuthorPostId,
      slug: "null-author-post",
      title: "Null author",
      status: "published",
      publishedAt: new Date(),
      authorId: null,
    },
    {
      id: assignedPostId,
      slug: "assigned-author-post",
      title: "Assigned author",
      status: "published",
      publishedAt: new Date(),
      authorId: "other-author",
    },
  ]);

  return { nullAuthorPostId, assignedPostId };
}

describe("0017_backfill_null_post_author_g2 migration", () => {
  let client: Client;
  let partialMigrationsDir: string;

  afterEach(() => {
    client?.close();
    if (partialMigrationsDir) {
      rmSync(partialMigrationsDir, { recursive: true, force: true });
    }
  });

  it("sets author_id to g2 for null rows and leaves existing author_id unchanged", async () => {
    partialMigrationsDir = createMigrationsFolderThrough0016();
    client = createClient({ url: ":memory:" });
    const db = drizzle({ client, schema });

    await migrate(db, { migrationsFolder: partialMigrationsDir });
    const { nullAuthorPostId, assignedPostId } = await seedBackfillFixtures(db);

    await migrate(db, { migrationsFolder: "./drizzle" });

    const nullAuthorRow = await db.query.posts.findFirst({
      where: eq(posts.id, nullAuthorPostId),
    });
    const assignedRow = await db.query.posts.findFirst({
      where: eq(posts.id, assignedPostId),
    });

    expect(nullAuthorRow?.authorId).toBe("g2");
    expect(assignedRow?.authorId).toBe("other-author");

    await migrate(db, { migrationsFolder: "./drizzle" });

    const nullAuthorAfterRerun = await db.query.posts.findFirst({
      where: eq(posts.id, nullAuthorPostId),
    });
    const assignedAfterRerun = await db.query.posts.findFirst({
      where: eq(posts.id, assignedPostId),
    });

    expect(nullAuthorAfterRerun?.authorId).toBe("g2");
    expect(assignedAfterRerun?.authorId).toBe("other-author");
  });
});
