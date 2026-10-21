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
  assertLiveImportCollisions,
  BeehiivLiveCollisionError,
  countBeehiivPostStatuses,
  countBeehiivSubscriberStatuses,
  formatBeehiivImportSummaryForLog,
  KNOWN_DROPPED_BEEHIIV_IMAGE_MARKERS,
  maskEmail,
  parseBeehiivPosts,
  parseBeehiivSubscriberRow,
  preparePostImagesForLive,
  runBeehiivImport,
} from "./lib";
import { slugifyBeehiivTitle } from "./slug";

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
  it("uses a title-based slug when post URL is missing", () => {
    const csv = `id,web_title,status,url,email_subject_line,email_preview_text,content_html,created_at
a67e8e9e-0000-4000-8000-000000000001,Black Friday Exclusive,confirmed,,Sub,Preview,"<p>sale</p>",2023-11-01 12:00:00 UTC
`;
    const rows = parseBeehiivPosts(csv);
    expect(rows[0]?.slug).toBe(slugifyBeehiivTitle("Black Friday Exclusive"));
    expect(rows[0]?.slug).toBe("black-friday-exclusive");
  });

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

  it("aborts live import on slug or sourceGuid collisions", async () => {
    const { db, url } = await createTestDb();
    await db.insert(posts).values({
      id: "existing-post",
      slug: "second",
      title: "Existing",
      status: "published",
      sourceGuid: "beehiiv:other",
      source: "beehiiv",
    });

    await expect(
      runBeehiivImport({
        db,
        databaseUrl: url,
        postsCsv: samplePostsCsv,
        subscribersCsv: sampleSubsCsv,
        live: true,
        uploadFn: vi.fn(),
        fetchFn: vi.fn(async () => new Response(null, { status: 200 })),
      }),
    ).rejects.toBeInstanceOf(BeehiivLiveCollisionError);

    expect(() =>
      assertLiveImportCollisions({
        slugCollisionsAmongImport: ["dup"],
        slugCollisionsWithExisting: [],
        existingSourceGuids: [],
      }),
    ).toThrow(BeehiivLiveCollisionError);
  });

  it("skips posts with image upload failures but keeps known-dropped images", async () => {
    const storyThumb =
      "https://media.beehiiv.com/cdn-cgi/image/fit=scale-down/uploads/publication/thumbnail/landscape_Story_telling__1280_x_720_px_.jpg";
    const postsCsv = `id,web_title,status,url,email_subject_line,email_preview_text,content_html,created_at
ok-1,OK Post,confirmed,https://example.test/p/ok,Sub,Preview,"<p>ok</p>",2023-03-01 12:00:00 UTC
bad-1,Bad Post,confirmed,https://example.test/p/bad,Sub,Preview,"<img src=https://media.beehiiv.com/cdn/img/missing.png />",2023-03-02 12:00:00 UTC
drop-1,Drop Post,confirmed,https://example.test/p/drop,Sub,Preview,"<img src=${storyThumb} /><p>text</p>",2023-03-03 12:00:00 UTC
`;
    const subsCsv = `subscriber_id,email,status,created_at,updated_at,unsubscribed_at
`;

    const { db, url } = await createTestDb();
    const uploadFn = vi.fn();
    const fetchFn = vi.fn(async (requestUrl: RequestInfo | URL) => {
      if (String(requestUrl).includes("missing.png")) {
        return new Response(null, { status: 403 });
      }
      return new Response(Buffer.from("x"), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }) as typeof fetch;

    const summary = await runBeehiivImport({
      db,
      databaseUrl: url,
      postsCsv,
      subscribersCsv: subsCsv,
      live: true,
      fetchFn,
      uploadFn,
    });

    expect(summary.posts.postsSkippedDueToImageFailures).toHaveLength(1);
    expect(summary.posts.postsSkippedDueToImageFailures[0]?.slug).toBe("bad");
    expect(summary.posts.knownDroppedImageMarkers).toEqual(
      KNOWN_DROPPED_BEEHIIV_IMAGE_MARKERS,
    );
    expect(summary.posts.knownDroppedImagesApplied.length).toBeGreaterThan(0);

    const inserted = await db.select().from(posts);
    expect(inserted.map((row) => row.slug).sort()).toEqual(["drop", "ok"]);
    expect(
      inserted.find((row) => row.slug === "drop")?.bodyHtml,
    ).not.toContain("landscape_Story_telling");
  });

  it("preparePostImagesForLive drops known Story_telling thumbnail", async () => {
    const storyThumb =
      "https://media.beehiiv.com/x/landscape_Story_telling__1280_x_720_px_.jpg";
    const result = await preparePostImagesForLive({
      html: `<img src="${storyThumb}" /><p>hi</p>`,
      fetchFn: vi.fn(),
      uploadFn: vi.fn(),
      urlMapping: new Map(),
    });
    expect(result.knownDropped).toHaveLength(1);
    expect(result.hardFailures).toHaveLength(0);
    expect(result.html).not.toContain("Story_telling");
  });

  it("live import commits posts and subscribers in one transaction", async () => {
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

    await expect(
      runBeehiivImport({
        db,
        databaseUrl: url,
        postsCsv: samplePostsCsv,
        subscribersCsv: sampleSubsCsv,
        live: true,
        fetchFn,
        uploadFn,
      }),
    ).rejects.toBeInstanceOf(BeehiivLiveCollisionError);

    const secondDry = await runBeehiivImport({
      db,
      databaseUrl: url,
      postsCsv: samplePostsCsv,
      subscribersCsv: sampleSubsCsv,
      live: false,
      fetchFn,
      uploadFn,
    });
    expect(secondDry.posts.existingSourceGuids).toHaveLength(2);
    expect(secondDry.subscribers.existingEmails).toEqual(
      expect.arrayContaining(["active@example.test", "quiet@example.test"]),
    );

    const welcome = await db
      .select()
      .from(posts)
      .where(eq(posts.sourceGuid, "beehiiv:pub-1"));
    expect(welcome[0]?.bodyHtml).toContain("https://api.grove.storage/abc");
  });

  it("masks emails in formatted summary", () => {
    const masked = formatBeehiivImportSummaryForLog({
      mode: "dry-run",
      prod: true,
      databaseHost: "file:local",
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
        postsSkippedDueToImageFailures: [],
        knownDroppedImageMarkers: KNOWN_DROPPED_BEEHIIV_IMAGE_MARKERS,
        knownDroppedImagesApplied: [],
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
