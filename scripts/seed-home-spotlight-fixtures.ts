/**
 * Local-only fixtures for homepage spotlight screenshots and manual QA.
 * Usage:
 *   LOCAL_DATABASE_URL=file:.local/dear-creative.db tsx scripts/seed-home-spotlight-fixtures.ts
 *   LOCAL_DATABASE_URL=file:.local/dear-creative.db tsx scripts/seed-home-spotlight-fixtures.ts --single
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql";
import { inArray } from "drizzle-orm";
import {
  createDbClient,
  isLocalLibsqlUrl,
  resolveDatabaseUrl,
} from "../src/db/client";
import { posts } from "../src/db/schema";

const FIXTURE_SLUGS = [
  "fixture-spotlight-newest",
  "fixture-spotlight-svg-fallback",
  "fixture-spotlight-truncated-teaser",
  "fixture-spotlight-draft-hidden",
  "fixture-spotlight-scheduled-future",
  "hello-dear-creative",
] as const;

const LONG_BODY_PLAIN =
  "Onchain creators are rebuilding publishing without gatekeepers. " +
  "This paragraph is intentionally long so the homepage spotlight can derive a teaser from plain body text when no excerpt is stored, " +
  "stripping markup and cutting near one hundred sixty characters on a word boundary with an ellipsis at the end.";

async function main() {
  const singleLayout = process.argv.includes("--single");
  const url = resolveDatabaseUrl();

  if (!isLocalLibsqlUrl(url)) {
    console.error(
      "Refusing to seed: use a local file: or :memory: libSQL URL (LOCAL_DATABASE_URL).",
    );
    process.exit(1);
  }

  if (url.startsWith("file:")) {
    const path = url.replace(/^file:/, "");
    mkdirSync(dirname(path), { recursive: true });
  }

  const client = createDbClient(url);
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: "./drizzle" });

  await db.delete(posts).where(inArray(posts.slug, [...FIXTURE_SLUGS]));

  const now = new Date();
  const rows: (typeof posts.$inferInsert)[] = [
    {
      id: randomUUID(),
      slug: "fixture-spotlight-newest",
      title: "Newest: Autonomous Creator Dispatch",
      status: "published",
      publishedAt: new Date("2026-10-18T12:00:00.000Z"),
      teaserText:
        "Fixture excerpt — newest published post with a cover image in the public preview.",
      freeContent: `<p>Lead paragraph for the newest fixture issue.</p><img src="/images/hello-dear-creative-banner.jpg" alt="Fixture cover art for newest dispatch" /><p>More context below the hero image.</p>`,
      bodyHtml: "<p>Paid/full body (not used on homepage).</p>",
      source: "paragraph",
      createdAt: now,
      updatedAt: now,
    },
  ];

  if (!singleLayout) {
    rows.push(
      {
        id: randomUUID(),
        slug: "fixture-spotlight-svg-fallback",
        title: "SVG Fallback: No Cover Image",
        status: "published",
        publishedAt: new Date("2026-10-12T09:00:00.000Z"),
        teaserText:
          "Fixture excerpt — middle post with no images; cover uses deterministic SVG.",
        freeContent:
          "<p>Plain public preview only — no embedded images, so the card should show the generated Dear Creative banner SVG.</p>",
        bodyHtml: "<p>Paid/full body (not used on homepage).</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        slug: "fixture-spotlight-preview-teaser",
        title: "Preview-Derived Teaser",
        status: "published",
        publishedAt: new Date("2026-10-08T09:00:00.000Z"),
        teaserText: null,
        freeContent: LONG_BODY_PLAIN,
        bodyHtml: "<p>Paid/full body must not appear in list teasers.</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        slug: "fixture-spotlight-draft-hidden",
        title: "Draft Hidden From Spotlight",
        status: "draft",
        publishedAt: null,
        teaserText: "Should never appear on the homepage.",
        bodyHtml: "<p>Draft fixture body.</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        slug: "fixture-spotlight-scheduled-future",
        title: "Scheduled Future Publish",
        status: "published",
        publishedAt: new Date("2026-11-15T09:00:00.000Z"),
        teaserText: "Future-dated publish — excluded from spotlight.",
        bodyHtml: "<p>Scheduled fixture body.</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
    );
  } else {
    rows.push(
      {
        id: randomUUID(),
        slug: "fixture-spotlight-draft-hidden",
        title: "Draft Hidden From Spotlight",
        status: "draft",
        publishedAt: null,
        teaserText: "Should never appear on the homepage.",
        bodyHtml: "<p>Draft fixture body.</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        slug: "fixture-spotlight-scheduled-future",
        title: "Scheduled Future Publish",
        status: "published",
        publishedAt: new Date("2026-11-15T09:00:00.000Z"),
        teaserText: "Future-dated publish — excluded from spotlight.",
        bodyHtml: "<p>Scheduled fixture body.</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
    );
  }

  await db.insert(posts).values(rows);

  console.log(
    singleLayout
      ? "Seeded 1 published + draft + scheduled spotlight fixtures (--single)."
      : "Seeded 3 published + draft + scheduled spotlight fixtures.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
