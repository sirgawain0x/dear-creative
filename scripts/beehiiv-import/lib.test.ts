import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../../src/db/schema";
import { posts, subscribers } from "../../src/db/schema";
import { parseCsvRows } from "./csv";
import { isBeehiivHostedImageUrl } from "./images";
import {
  applyBeehiivSlugRules,
  countBeehiivPostStatuses,
  countBeehiivSubscriberStatuses,
  formatBeehiivImportSummaryForLog,
  maskEmail,
  parseBeehiivPosts,
  parseBeehiivSubscriberRow,
  runBeehiivImport,
} from "./lib";

async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "beehiiv-import-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db, url };
}

const samplePostsCsv = `id,web_title,status,url,email_subject_line,email_preview_text,content_html,created_at
draft-1,Draft Post,draft,,Sub,Preview,"<p>draft</p>",2024-01-01 12:00:00 UTC
pub-1,Welcome Post,confirmed,https://example.test/p/welcome,Welcome,Preview,"<img src=\"https://media.beehiiv.com/cdn/img/a.png\" />",2023-03-01 12:00:00 UTC
pub-2,Second,confirmed,https://example.test/p/second,Sub2,Prev2,"<p>body</p>",2023-04-01 12:00:00 UTC
`;

const sampleSubsCsv = `subscriber_id,email,status,created_at,updated_at,unsubscribed_at
1,active@example.test,active,2023-01-01 12:00:00 UTC,2023-01-01 12:00:00 UTC,
2,quiet@example.test,inactive,2023-01-01 12:00:00 UTC,2023-02-01 12:00:00 UTC,2023-02-01 12:00:00 UTC
3,pending@example.test,pending,2023-01-01 12:00:00 UTC,2023-01-01 12:00:00 UTC,
`;

describe("beehiiv CSV parsing", () => {
  it("parses headers and rows", () => {
    const parsed = parseCsvRows("a,b\n1,2\n");
    expect(parsed.headers).toEqual(["a", "b"]);
    expect(parsed.rows).toEqual([{ a: "1", b: "2" }]);
  });

  it("parses quoted fields that span newlines", () => {
    const parsed = parseCsvRows(
      'id,html\n1,"line1\nline2"\n',
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.html).toBe("line1\nline2");
  });

  it("filters post statuses and counts", () => {
    const counts = countBeehiivPostStatuses(samplePostsCsv);
    expect(counts.total).toBe(3);
    expect(counts.draftSkipped).toBe(1);
    expect(counts.importablePublished).toBe(2);
  });

  it("filters subscriber statuses and counts", () => {
    const counts = countBeehiivSubscriberStatuses(sampleSubsCsv);
    expect(counts.total).toBe(3);
    expect(counts.active).toBe(1);
    expect(counts.inactive).toBe(1);
    expect(counts.pending).toBe(1);
  });
});

describe("beehiiv slug rules", () => {
  it("renames welcome to welcome-2023", () => {
    expect(applyBeehiivSlugRules("welcome")).toEqual({
      slug: "welcome-2023",
      renamed: true,
    });
    const rows = parseBeehiivPosts(samplePostsCsv);
    expect(rows.find((row) => row.beehiivId === "pub-1")?.slug).toBe(
      "welcome-2023",
    );
  });
});

describe("beehiiv image helpers", () => {
  it("detects Beehiiv-hosted image URLs", () => {
    expect(
      isBeehiivHostedImageUrl("https://media.beehiiv.com/cdn/img/a.png"),
    ).toBe(true);
    expect(isBeehiivHostedImageUrl("https://twitter.com/x")).toBe(false);
  });
});

describe("runBeehiivImport", () => {
  it("dry run performs no writes or uploads", async () => {
    const { db, url } = await createTestDb();
    const uploadFn = vi.fn();
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));

    const summary = await runBeehiivImport({
      db,
      databaseUrl: url,
      postsCsv: samplePostsCsv,
      subscribersCsv: sampleSubsCsv,
      live: false,
      fetchFn,
      uploadFn,
    });

    expect(summary.writesPerformed).toBe(false);
    expect(uploadFn).not.toHaveBeenCalled();
    expect(summary.posts.toInsert).toBe(2);
    expect(summary.subscribers.toInsertActive).toBe(1);
    expect(summary.subscribers.toInsertSuppressed).toBe(1);
    expect(summary.subscribers.pendingSkipped).toBe(1);

    const postCount = await db.select().from(posts);
    const subCount = await db.select().from(subscribers);
    expect(postCount).toHaveLength(0);
    expect(subCount).toHaveLength(0);
  });

  it("is idempotent for posts, subscribers, and images on live re-run", async () => {
    const { db, url } = await createTestDb();
    const uploadFn = vi.fn(async () => ({
      uri: "lens://abc",
      gatewayUrl: "https://api.grove.storage/abc",
      storageKey: "abc",
    }));
    const fetchFn = vi.fn(
      async () =>
        new Response(Buffer.from("fake-png"), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );

    const first = await runBeehiivImport({
      db,
      databaseUrl: url,
      postsCsv: samplePostsCsv,
      subscribersCsv: sampleSubsCsv,
      live: true,
      fetchFn,
      uploadFn,
    });
    expect(first.writesPerformed).toBe(true);
    expect(first.posts.imagesUploaded).toBe(1);
    expect(uploadFn).toHaveBeenCalledTimes(1);

    uploadFn.mockClear();
    fetchFn.mockClear();

    const second = await runBeehiivImport({
      db,
      databaseUrl: url,
      postsCsv: samplePostsCsv,
      subscribersCsv: sampleSubsCsv,
      live: true,
      fetchFn,
      uploadFn,
    });

    expect(second.posts.existingSourceGuids).toHaveLength(2);
    expect(second.posts.toInsert).toBe(0);
    expect(second.subscribers.existingEmails).toEqual(
      expect.arrayContaining(["active@example.test", "quiet@example.test"]),
    );
    expect(second.subscribers.toInsertActive).toBe(0);
    expect(second.subscribers.toInsertSuppressed).toBe(0);
    expect(uploadFn).not.toHaveBeenCalled();

    const welcome = await db
      .select()
      .from(posts)
      .where(eq(posts.sourceGuid, "beehiiv:pub-1"));
    expect(welcome[0]?.bodyHtml).toContain("https://api.grove.storage/abc");
  });

  it("masks emails in formatted summary", () => {
    const masked = formatBeehiivImportSummaryForLog({
      mode: "dry-run",
      databaseUrl: "file:test.db",
      posts: {
        csvRows: 0,
        draftSkipped: 0,
        otherStatusSkipped: 0,
        importablePublished: 0,
        slugRenamed: 0,
        slugCollisionsAmongImport: [],
        slugCollisionsWithExisting: [],
        existingSourceGuids: [],
        toInsert: 0,
        imageUrlsUnique: 0,
        imageHeadChecks: { ok: 0, failed: 0, failures: [] },
        imagesUploaded: 0,
        imagesSkippedMapped: 0,
        imageUploadFailures: [],
      },
      subscribers: {
        csvRows: 1,
        activeImported: 1,
        suppressedStored: 0,
        pendingSkipped: 0,
        invalidSkipped: 0,
        existingEmails: ["secret@example.test"],
        toInsertActive: 0,
        toInsertSuppressed: 0,
      },
      writesPerformed: false,
    });
    expect(masked.subscribers).toMatchObject({
      existingEmails: ["s***@example.test"],
    });
    expect(maskEmail("secret@example.test")).toBe("s***@example.test");
  });
});

describe("parseBeehiivSubscriberRow", () => {
  it("maps inactive to suppressed planning row", () => {
    const row = parseBeehiivSubscriberRow({
      email: "x@example.test",
      status: "inactive",
      created_at: "2023-01-01 12:00:00 UTC",
      unsubscribed_at: "2023-02-01 12:00:00 UTC",
    });
    expect(row?.status).toBe("inactive");
  });
});
