import { eq, like } from "drizzle-orm";
import type { DearCreativeDb } from "../../src/db/client";
import { posts } from "../../src/db/schema";
import { cleanBeehiivPostHtml, type CleanupCounts } from "./clean-html";
import { parseCsvRecords } from "./csv";
import {
  applyWelcomeSlugRename,
  buildBeehiivSlugMapFromDbPosts,
  buildBeehiivSlugMapFromPostsCsv,
  enrichSlugMapFromDbCanonicals,
  slugFromBeehiivUrl,
  slugifyTitle,
} from "./slug-map";

const BEEHIIV_PUBLISHED = new Set(["confirmed", "published"]);

export type PostCleanupSummary = {
  slug: string;
  sourceGuid?: string;
  changed: boolean;
  counts: CleanupCounts;
};

export type CleanupRunSummary = {
  mode: "dry-run" | "live";
  prod: boolean;
  databaseHost: string | null;
  source: "csv" | "database";
  postsProcessed: number;
  postsChanged: number;
  posts: PostCleanupSummary[];
  writesPerformed: boolean;
};

function parseCsvPosts(content: string): Array<{
  slug: string;
  sourceGuid: string;
  bodyHtml: string;
}> {
  const records = parseCsvRecords(content);
  if (records.length < 2) {
    return [];
  }
  const headers = records[0]!.map((h) => h.replace(/^\uFEFF/, "").trim());
  const out: Array<{ slug: string; sourceGuid: string; bodyHtml: string }> = [];

  for (const cells of records.slice(1)) {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? "";
    });
    const status = (row.status ?? "").trim().toLowerCase();
    if (!BEEHIIV_PUBLISHED.has(status)) {
      continue;
    }
    const id = (row.id ?? "").trim();
    if (!id) {
      continue;
    }
    const title = (row.web_title ?? row.title ?? "").trim() || "Untitled";
    let beehiivSlug = slugFromBeehiivUrl(row.url);
    if (!beehiivSlug) {
      beehiivSlug = slugifyTitle(title);
    }
    const slug = applyWelcomeSlugRename(beehiivSlug);
    out.push({
      slug,
      sourceGuid: `beehiiv:${id}`,
      bodyHtml: row.content_html ?? "",
    });
  }

  return out;
}

export async function runBeehiivBodyCleanupFromCsv(input: {
  postsCsv: string;
}): Promise<CleanupRunSummary> {
  const slugMap = buildBeehiivSlugMapFromPostsCsv(input.postsCsv);
  const csvPosts = parseCsvPosts(input.postsCsv);
  const summaries: PostCleanupSummary[] = [];

  for (const post of csvPosts) {
    const cleaned = cleanBeehiivPostHtml(post.bodyHtml, slugMap);
    summaries.push({
      slug: post.slug,
      sourceGuid: post.sourceGuid,
      changed: cleaned.changed,
      counts: cleaned.counts,
    });
  }

  return {
    mode: "dry-run",
    prod: false,
    databaseHost: null,
    source: "csv",
    postsProcessed: summaries.length,
    postsChanged: summaries.filter((row) => row.changed).length,
    posts: summaries,
    writesPerformed: false,
  };
}

export async function runBeehiivBodyCleanupFromDb(input: {
  db: DearCreativeDb;
  live: boolean;
  prod: boolean;
  databaseHost: string;
  postsCsvForSlugMap?: string;
}): Promise<CleanupRunSummary> {
  const dbPosts = await input.db
    .select({
      id: posts.id,
      slug: posts.slug,
      sourceGuid: posts.sourceGuid,
      canonicalUrl: posts.canonicalUrl,
      bodyHtml: posts.bodyHtml,
    })
    .from(posts)
    .where(like(posts.sourceGuid, "beehiiv:%"));

  const slugMap = buildBeehiivSlugMapFromDbPosts(
    dbPosts.map((row) => ({
      id: row.id,
      slug: row.slug,
      sourceGuid: row.sourceGuid ?? "",
      bodyHtml: row.bodyHtml,
    })),
  );
  enrichSlugMapFromDbCanonicals(
    slugMap,
    dbPosts.map((row) => ({ slug: row.slug, canonicalUrl: row.canonicalUrl })),
  );
  if (input.postsCsvForSlugMap) {
    const fromCsv = buildBeehiivSlugMapFromPostsCsv(input.postsCsvForSlugMap);
    for (const [key, value] of fromCsv) {
      slugMap.set(key, value);
    }
  }

  const summaries: PostCleanupSummary[] = [];
  const updates: Array<{ id: string; bodyHtml: string }> = [];

  for (const post of dbPosts) {
    const html = post.bodyHtml ?? "";
    const cleaned = cleanBeehiivPostHtml(html, slugMap);
    summaries.push({
      slug: post.slug,
      sourceGuid: post.sourceGuid ?? undefined,
      changed: cleaned.changed,
      counts: cleaned.counts,
    });
    if (cleaned.changed) {
      updates.push({ id: post.id, bodyHtml: cleaned.html });
    }
  }

  let writesPerformed = false;
  if (input.live && updates.length > 0) {
    await input.db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(posts)
          .set({ bodyHtml: update.bodyHtml })
          .where(eq(posts.id, update.id));
      }
    });
    writesPerformed = true;
  }

  return {
    mode: input.live ? "live" : "dry-run",
    prod: input.prod,
    databaseHost: input.databaseHost,
    source: "database",
    postsProcessed: summaries.length,
    postsChanged: summaries.filter((row) => row.changed).length,
    posts: summaries,
    writesPerformed,
  };
}
