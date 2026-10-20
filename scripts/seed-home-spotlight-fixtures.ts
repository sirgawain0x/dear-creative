/**
 * Local-only fixtures for homepage spotlight screenshots and manual QA.
 *
 *   LOCAL_DATABASE_URL=file:.local/dear-creative.db npm run seed:home-spotlight
 *   LOCAL_DATABASE_URL=file:.local/dear-creative.db npm run seed:home-spotlight -- --no-teaser-shot
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
  "fixture-spotlight-grove-cover",
  "fixture-spotlight-unlisted-host-cover",
  "fixture-spotlight-no-cover",
  "fixture-spotlight-no-teaser-paid",
  "fixture-spotlight-draft-hidden",
  "fixture-spotlight-scheduled-future",
  "fixture-spotlight-newest",
  "fixture-spotlight-svg-fallback",
  "fixture-spotlight-preview-teaser",
  "hello-dear-creative",
] as const;

/** Public Grove JPEG uploaded via anonymous POST (chain_id=232); verified 200 image/jpeg. */
const GROVE_FIXTURE_COVER_URL =
  "https://api.grove.storage/95f583249cbf56cfb647ef3e76315338330388444317ddb20439cbaa5ebcf777";

function hiddenPosts(now: Date): (typeof posts.$inferInsert)[] {
  return [
    {
      id: randomUUID(),
      slug: "fixture-spotlight-draft-hidden",
      title: "Draft Hidden From Spotlight",
      status: "draft",
      publishedAt: null,
      teaserText: "Must not appear on the homepage.",
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
      teaserText: "Future-dated — excluded from spotlight.",
      bodyHtml: "<p>Scheduled fixture body.</p>",
      source: "paragraph",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

async function main() {
  const noTeaserShot = process.argv.includes("--no-teaser-shot");
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
  let rows: (typeof posts.$inferInsert)[];

  if (noTeaserShot) {
    rows = [
      {
        id: randomUUID(),
        slug: "fixture-spotlight-no-teaser-paid",
        title: "Paid Post: No Teaser",
        status: "published",
        publishedAt: new Date("2026-10-20T12:00:00.000Z"),
        teaserText: null,
        freeContent: null,
        bodyHtml:
          "<p>Paid body only — no excerpt or free preview for the public list.</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
      ...hiddenPosts(now),
    ];
  } else {
    rows = [
      {
        id: randomUUID(),
        slug: "fixture-spotlight-grove-cover",
        title: "Grove Cover Image",
        status: "published",
        publishedAt: new Date("2026-10-20T12:00:00.000Z"),
        teaserText: "Fixture — cover loaded from api.grove.storage (unoptimized).",
        freeContent:
          `<p>Public preview with Grove art.</p><img src="${GROVE_FIXTURE_COVER_URL}" alt="Grove fixture cover" />`,
        bodyHtml: "<p>Paid/full body.</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        slug: "fixture-spotlight-unlisted-host-cover",
        title: "Unlisted Host → SVG Banner",
        status: "published",
        publishedAt: new Date("2026-10-19T12:00:00.000Z"),
        teaserText:
          "Fixture — img host is not allowlisted; card should show deterministic SVG.",
        freeContent:
          '<p>Public preview references a blocked host.</p><img src="https://example.com/not-on-allowlist.png" alt="Blocked" />',
        bodyHtml: "<p>Paid/full body.</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        slug: "fixture-spotlight-no-cover",
        title: "No Cover Image",
        status: "published",
        publishedAt: new Date("2026-10-18T12:00:00.000Z"),
        teaserText:
          "Fixture — no image in preview; deterministic SVG banner fallback.",
        freeContent:
          "<p>Plain public preview text with no embedded images.</p>",
        bodyHtml: "<p>Paid/full body.</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        slug: "fixture-spotlight-no-teaser-paid",
        title: "Paid Post: No Teaser",
        status: "published",
        publishedAt: new Date("2026-10-17T12:00:00.000Z"),
        teaserText: null,
        freeContent: null,
        bodyHtml:
          "<p>Paid body only — excluded from top 3 but validates empty teaser when surfaced.</p>",
        source: "paragraph",
        createdAt: now,
        updatedAt: now,
      },
      ...hiddenPosts(now),
    ];
  }

  await db.insert(posts).values(rows);

  console.log(
    noTeaserShot
      ? "Seeded no-teaser spotlight shot (1 eligible + draft + future)."
      : "Seeded 4 eligible published + draft + future (spotlight shows newest 3).",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
