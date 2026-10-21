import { createHash, randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import type { DearCreativeDb } from "../../src/db/client";
import { posts, subscribers } from "../../src/db/schema";
import type { LensGroveUploadResult } from "../../src/lib/storage/lens-grove";
import { parseCsvRows } from "./csv";
import {
  extractBeehiivImageUrls,
  isBeehiivHostedImageUrl,
  rewriteHtmlImageUrls,
  stripImageTagsContainingUrls,
} from "./images";
import {
  isKnownDroppedBeehiivImageUrl,
  KNOWN_DROPPED_BEEHIIV_IMAGE_MARKERS,
} from "./known-dropped-images";
import { safeDatabaseHost } from "./prod-mode";
import { slugifyBeehiivTitle } from "./slug";
import { parseBeehiivUtcTimestamp } from "./dates";
import {
  applyExistingSubscriberDbRules,
  mergeSubscriberImports,
  type CombinedSubscriberSummary,
  type SubscriberFileSummary,
} from "./subscribers-merge";

import {
  assertImportDatabaseUrl,
  isValidEmail,
} from "../paragraph-import/lib";

export { assertImportDatabaseUrl, isValidEmail };
export { parseCsvRows } from "./csv";
export { isBeehiivHostedImageUrl } from "./images";
export { parseBeehiivUtcTimestamp } from "./dates";
export {
  parseBeehiivSubscriberRow,
  countBeehiivSubscriberStatuses,
} from "./beehiiv-subscribers";
export { parseParagraphSubscriberRow } from "./subscribers-merge";

export type BeehiivPostRow = {
  beehiivId: string;
  title: string;
  slug: string;
  status: string;
  bodyHtml: string;
  emailSubject: string | null;
  teaserText: string | null;
  canonicalUrl: string | null;
  publishedAt: Date;
  sourceGuid: string;
};

export class BeehiivLiveCollisionError extends Error {
  constructor(
    message: string,
    readonly collisions: {
      slugCollisionsAmongImport: string[];
      slugCollisionsWithExisting: string[];
      existingSourceGuids: string[];
    },
  ) {
    super(message);
    this.name = "BeehiivLiveCollisionError";
  }
}

export type BeehiivImportSummary = {
  mode: "dry-run" | "live";
  prod: boolean;
  databaseHost: string;
  posts: {
    csvRows: number;
    draftSkipped: number;
    otherStatusSkipped: number;
    importablePublished: number;
    slugRenamed: number;
    slugCollisionsAmongImport: string[];
    slugCollisionsWithExisting: string[];
    existingSourceGuids: string[];
    toInsert: number;
    imageUrlsUnique: number;
    imageHeadChecks: {
      ok: number;
      failed: number;
      failures: Array<{ url: string; status: number | null; error?: string }>;
    };
    imagesUploaded: number;
    imagesSkippedMapped: number;
    imageUploadFailures: string[];
    postsSkippedDueToImageFailures: Array<{
      sourceGuid: string;
      slug: string;
      failedUrls: string[];
    }>;
    knownDroppedImageMarkers: readonly string[];
    knownDroppedImagesApplied: string[];
  };
  subscribers: {
    beehiiv: SubscriberFileSummary;
    paragraph: SubscriberFileSummary | null;
    combined: CombinedSubscriberSummary;
    existingEmails: string[];
    openQuestions: readonly string[];
  };
  writesPerformed: boolean;
};

export type UploadImageFn = (
  bytes: Buffer,
  fileName: string,
  contentType: string,
) => Promise<LensGroveUploadResult>;

export type FetchLike = typeof fetch;

const BEEHIIV_PUBLISHED_STATUSES = new Set(["confirmed", "published"]);

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) {
    return "(invalid)";
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function slugFromBeehiivUrl(url: string | null | undefined): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    const segment = parsed.pathname.replace(/\/+$/, "").split("/").pop() ?? "";
    return segment.trim();
  } catch {
    return "";
  }
}

export function applyBeehiivSlugRules(slug: string): {
  slug: string;
  renamed: boolean;
} {
  if (slug === "welcome") {
    return { slug: "welcome-2023", renamed: true };
  }
  return { slug, renamed: false };
}

export function parseBeehiivPosts(content: string): BeehiivPostRow[] {
  const { rows } = parseCsvRows(content);
  const parsed: BeehiivPostRow[] = [];

  for (const row of rows) {
    const status = (row.status ?? "").trim().toLowerCase();
    if (!BEEHIIV_PUBLISHED_STATUSES.has(status)) {
      continue;
    }

    const beehiivId = (row.id ?? "").trim();
    if (!beehiivId) {
      continue;
    }

    const publishedAt =
      parseBeehiivUtcTimestamp(row.published_at ?? "") ??
      parseBeehiivUtcTimestamp(row.created_at ?? "");
    if (!publishedAt) {
      continue;
    }

    const title =
      (row.web_title ?? row.title ?? "Untitled").trim() || "Untitled";
    let rawSlug = slugFromBeehiivUrl(row.url);
    if (!rawSlug) {
      rawSlug = slugifyBeehiivTitle(title);
    }
    const slugRules = applyBeehiivSlugRules(rawSlug);

    parsed.push({
      beehiivId,
      title,
      slug: slugRules.slug,
      status,
      bodyHtml: row.content_html ?? "",
      emailSubject: (row.email_subject_line ?? "").trim() || null,
      teaserText: (row.email_preview_text ?? row.web_subtitle ?? "").trim() || null,
      canonicalUrl: (row.url ?? "").trim() || null,
      publishedAt,
      sourceGuid: `beehiiv:${beehiivId}`,
    });
  }

  return parsed;
}

export function countBeehiivPostStatuses(content: string): {
  total: number;
  draftSkipped: number;
  otherStatusSkipped: number;
  importablePublished: number;
} {
  const { rows } = parseCsvRows(content);
  let draftSkipped = 0;
  let otherStatusSkipped = 0;
  let importablePublished = 0;

  for (const row of rows) {
    const status = (row.status ?? "").trim().toLowerCase();
    if (BEEHIIV_PUBLISHED_STATUSES.has(status)) {
      importablePublished += 1;
      continue;
    }
    if (status === "draft") {
      draftSkipped += 1;
    } else {
      otherStatusSkipped += 1;
    }
  }

  return {
    total: rows.length,
    draftSkipped,
    otherStatusSkipped,
    importablePublished,
  };
}

function isMissingSqliteTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (message.includes("no such table")) {
    return true;
  }
  const cause = "cause" in error ? error.cause : undefined;
  if (cause && typeof cause === "object" && "message" in cause) {
    return String(cause.message).includes("no such table");
  }
  return false;
}

async function loadExistingPostsForImport(
  db: DearCreativeDb,
  allowMissingTables: boolean,
) {
  try {
    return await db
      .select({
        slug: posts.slug,
        sourceGuid: posts.sourceGuid,
      })
      .from(posts);
  } catch (error: unknown) {
    if (allowMissingTables && isMissingSqliteTableError(error)) {
      return [];
    }
    throw error;
  }
}

async function loadExistingSubscribersForImport(
  db: DearCreativeDb,
  emails: string[],
  allowMissingTables: boolean,
) {
  if (emails.length === 0) {
    return [];
  }
  try {
    return await db
      .select({ email: subscribers.email, status: subscribers.status })
      .from(subscribers)
      .where(inArray(subscribers.email, emails));
  } catch (error: unknown) {
    if (allowMissingTables && isMissingSqliteTableError(error)) {
      return [];
    }
    throw error;
  }
}

function findSlugCollisions(slugs: string[]): string[] {
  const counts = new Map<string, number>();
  for (const slug of slugs) {
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([slug]) => slug);
}

async function headCheckImageUrls(
  urls: string[],
  fetchFn: FetchLike,
): Promise<BeehiivImportSummary["posts"]["imageHeadChecks"]> {
  const result: BeehiivImportSummary["posts"]["imageHeadChecks"] = {
    ok: 0,
    failed: 0,
    failures: [],
  };

  for (const url of urls) {
    try {
      const response = await fetchFn(url, { method: "HEAD" });
      if (response.ok) {
        result.ok += 1;
      } else {
        result.failed += 1;
        result.failures.push({ url, status: response.status });
      }
    } catch (error: unknown) {
      result.failed += 1;
      result.failures.push({
        url,
        status: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) {
    return "bin";
  }
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }
  if (contentType.includes("png")) {
    return "png";
  }
  if (contentType.includes("gif")) {
    return "gif";
  }
  if (contentType.includes("webp")) {
    return "webp";
  }
  return "bin";
}

export type PreparePostImagesResult = {
  html: string;
  hardFailures: string[];
  knownDropped: string[];
  imagesUploaded: number;
  imagesSkippedMapped: number;
};

export async function preparePostImagesForLive(input: {
  html: string;
  fetchFn: FetchLike;
  uploadFn: UploadImageFn;
  urlMapping: Map<string, string>;
}): Promise<PreparePostImagesResult> {
  let html = input.html;
  const knownDropped: string[] = [];
  const hardFailures: string[] = [];
  let imagesUploaded = 0;
  let imagesSkippedMapped = 0;

  const urls = extractBeehiivImageUrls(html);
  const droppedThisPost = urls.filter(isKnownDroppedBeehiivImageUrl);
  if (droppedThisPost.length > 0) {
    html = stripImageTagsContainingUrls(html, droppedThisPost);
    knownDropped.push(...droppedThisPost);
  }

  const remainingUrls = extractBeehiivImageUrls(html);
  for (const sourceUrl of remainingUrls) {
    if (input.urlMapping.has(sourceUrl)) {
      imagesSkippedMapped += 1;
      continue;
    }

    try {
      const response = await input.fetchFn(sourceUrl);
      if (!response.ok) {
        hardFailures.push(sourceUrl);
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
      const hash = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16);
      const ext = extensionFromContentType(contentType);
      const uploaded = await input.uploadFn(
        bytes,
        `beehiiv-${hash}.${ext}`,
        contentType,
      );
      input.urlMapping.set(sourceUrl, uploaded.gatewayUrl);
      imagesUploaded += 1;
    } catch {
      hardFailures.push(sourceUrl);
    }
  }

  html = rewriteHtmlImageUrls(html, input.urlMapping);
  const remainingBeehiiv = extractBeehiivImageUrls(html);
  for (const url of remainingBeehiiv) {
    if (!hardFailures.includes(url)) {
      hardFailures.push(url);
    }
  }

  return {
    html,
    hardFailures,
    knownDropped,
    imagesUploaded,
    imagesSkippedMapped,
  };
}

export function assertLiveImportCollisions(input: {
  slugCollisionsAmongImport: string[];
  slugCollisionsWithExisting: string[];
  existingSourceGuids: string[];
}): void {
  const hasSlugCollision =
    input.slugCollisionsAmongImport.length > 0 ||
    input.slugCollisionsWithExisting.length > 0;
  const hasGuidCollision = input.existingSourceGuids.length > 0;
  if (!hasSlugCollision && !hasGuidCollision) {
    return;
  }
  throw new BeehiivLiveCollisionError(
    "Refusing --live: resolve slug or sourceGuid collisions before importing.",
    {
      slugCollisionsAmongImport: input.slugCollisionsAmongImport,
      slugCollisionsWithExisting: input.slugCollisionsWithExisting,
      existingSourceGuids: input.existingSourceGuids,
    },
  );
}

export { KNOWN_DROPPED_BEEHIIV_IMAGE_MARKERS };

export async function runBeehiivImport(input: {
  db: DearCreativeDb;
  databaseUrl: string;
  postsCsv: string;
  subscribersCsv: string;
  paragraphSubscribersCsv?: string;
  live: boolean;
  prod?: boolean;
  fetchFn?: FetchLike;
  uploadFn?: UploadImageFn;
}): Promise<BeehiivImportSummary> {
  const prod = input.prod ?? false;
  const databaseHost = safeDatabaseHost(input.databaseUrl);
  const fetchFn = input.fetchFn ?? fetch;
  const postStatusCounts = countBeehiivPostStatuses(input.postsCsv);
  const parsedPosts = parseBeehiivPosts(input.postsCsv);
  const slugRenamed = parsedPosts.filter((row) => row.slug === "welcome-2023").length;

  const importSlugs = parsedPosts.map((row) => row.slug);
  const slugCollisionsAmongImport = findSlugCollisions(importSlugs);

  const allowMissingTables = !input.live;
  const existingPosts = await loadExistingPostsForImport(
    input.db,
    allowMissingTables,
  );
  const existingSlugs = new Set(existingPosts.map((row) => row.slug));
  const existingGuids = new Set(
    existingPosts
      .map((row) => row.sourceGuid)
      .filter((guid): guid is string => Boolean(guid)),
  );

  const existingSourceGuids = parsedPosts
    .map((row) => row.sourceGuid)
    .filter((guid) => existingGuids.has(guid));

  const postsToInsert = parsedPosts.filter(
    (row) => !existingGuids.has(row.sourceGuid),
  );

  const slugCollisionsWithExisting = postsToInsert
    .map((row) => row.slug)
    .filter((slug) => existingSlugs.has(slug));

  const allImageUrls = new Set<string>();
  for (const row of parsedPosts) {
    for (const url of extractBeehiivImageUrls(row.bodyHtml)) {
      allImageUrls.add(url);
    }
  }

  const imageHeadChecks = input.live
    ? { ok: 0, failed: 0, failures: [] as BeehiivImportSummary["posts"]["imageHeadChecks"]["failures"] }
    : await headCheckImageUrls([...allImageUrls], fetchFn);

  const urlMapping = new Map<string, string>();
  let imagesUploaded = 0;
  let imagesSkippedMapped = 0;
  const imageUploadFailures: string[] = [];
  const postsSkippedDueToImageFailures: BeehiivImportSummary["posts"]["postsSkippedDueToImageFailures"] =
    [];
  const knownDroppedImagesApplied: string[] = [];

  const subscriberMerge = mergeSubscriberImports({
    beehiivCsv: input.subscribersCsv,
    paragraphCsv: input.paragraphSubscribersCsv,
  });

  const emailsToCheck = subscriberMerge.inserts.map((row) => row.email);
  let existingSubscriberRows: Array<{
    email: string;
    status: (typeof subscribers.$inferSelect)["status"];
  }> = [];
  existingSubscriberRows = await loadExistingSubscribersForImport(
    input.db,
    emailsToCheck,
    allowMissingTables,
  );

  const dbApplied = applyExistingSubscriberDbRules({
    inserts: subscriberMerge.inserts,
    existingRows: existingSubscriberRows,
  });

  const combined: CombinedSubscriberSummary = {
    ...subscriberMerge.combined,
    existingEmailsSkipped: dbApplied.existingEmailsSkipped.length,
    dbSuppressedBlocksResubscribe: dbApplied.dbSuppressedBlocksResubscribe,
    toInsertActive: dbApplied.toInsert.filter((row) => row.status === "subscribed")
      .length,
    toInsertSuppressed: dbApplied.toInsert.filter(
      (row) => row.status === "unsubscribed",
    ).length,
  };

  const existingEmails = dbApplied.existingEmailsSkipped;

  let writesPerformed = false;

  if (input.live) {
    assertLiveImportCollisions({
      slugCollisionsAmongImport,
      slugCollisionsWithExisting,
      existingSourceGuids,
    });

    if (!input.uploadFn) {
      throw new Error("uploadFn is required for --live Beehiiv import.");
    }

    const postsReadyForInsert: Array<{ row: BeehiivPostRow; bodyHtml: string }> =
      [];

    for (const row of postsToInsert) {
      const prepared = await preparePostImagesForLive({
        html: row.bodyHtml,
        fetchFn,
        uploadFn: input.uploadFn,
        urlMapping,
      });
      imagesUploaded += prepared.imagesUploaded;
      imagesSkippedMapped += prepared.imagesSkippedMapped;
      knownDroppedImagesApplied.push(...prepared.knownDropped);

      if (prepared.hardFailures.length > 0) {
        imageUploadFailures.push(...prepared.hardFailures);
        postsSkippedDueToImageFailures.push({
          sourceGuid: row.sourceGuid,
          slug: row.slug,
          failedUrls: prepared.hardFailures,
        });
        continue;
      }

      postsReadyForInsert.push({ row, bodyHtml: prepared.html });
    }

    const subscriberInserts = dbApplied.toInsert;

    if (postsReadyForInsert.length > 0 || subscriberInserts.length > 0) {
      await input.db.transaction(async (tx) => {
        for (const { row, bodyHtml } of postsReadyForInsert) {
          await tx.insert(posts).values({
            id: randomUUID(),
            slug: row.slug,
            title: row.title,
            status: "published",
            publishedAt: row.publishedAt,
            teaserText: row.teaserText,
            emailSubject: row.emailSubject,
            emailHtml: null,
            bodyHtml,
            canonicalUrl: row.canonicalUrl,
            sourceGuid: row.sourceGuid,
            source: "beehiiv",
            sponsorId: null,
          });
        }

        for (const sub of subscriberInserts) {
          await tx.insert(subscribers).values({
            id: randomUUID(),
            email: sub.email,
            status: sub.status,
            source: sub.source,
            subscribedAt:
              sub.subscribedAt ??
              (sub.status === "subscribed" ? new Date() : null),
            unsubscribedAt: sub.unsubscribedAt,
          });
        }
      });
      writesPerformed = true;
    }
  }

  return {
    mode: input.live ? "live" : "dry-run",
    prod,
    databaseHost,
    posts: {
      csvRows: postStatusCounts.total,
      draftSkipped: postStatusCounts.draftSkipped,
      otherStatusSkipped: postStatusCounts.otherStatusSkipped,
      importablePublished: postStatusCounts.importablePublished,
      slugRenamed,
      slugCollisionsAmongImport,
      slugCollisionsWithExisting,
      existingSourceGuids,
      toInsert: postsToInsert.length,
      imageUrlsUnique: allImageUrls.size,
      imageHeadChecks,
      imagesUploaded,
      imagesSkippedMapped,
      imageUploadFailures,
      postsSkippedDueToImageFailures,
      knownDroppedImageMarkers: KNOWN_DROPPED_BEEHIIV_IMAGE_MARKERS,
      knownDroppedImagesApplied: [...new Set(knownDroppedImagesApplied)],
    },
    subscribers: {
      beehiiv: subscriberMerge.beehiiv,
      paragraph: subscriberMerge.paragraph,
      combined,
      existingEmails,
      openQuestions: subscriberMerge.openQuestions,
    },
    writesPerformed,
  };
}

export function formatBeehiivImportSummaryForLog(
  summary: BeehiivImportSummary,
): Record<string, unknown> {
  return {
    ...summary,
    subscribers: {
      ...summary.subscribers,
      existingEmails: summary.subscribers.existingEmails.map(maskEmail),
    },
  };
}
