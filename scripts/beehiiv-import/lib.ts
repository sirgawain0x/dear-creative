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
} from "./images";

import {
  assertImportDatabaseUrl,
  isValidEmail,
} from "../paragraph-import/lib";

export { assertImportDatabaseUrl, isValidEmail };
export { parseCsvRows } from "./csv";
export { isBeehiivHostedImageUrl } from "./images";

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

export type BeehiivImportSummary = {
  mode: "dry-run" | "live";
  databaseUrl: string;
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
  };
  subscribers: {
    csvRows: number;
    activeImported: number;
    suppressedStored: number;
    pendingSkipped: number;
    invalidSkipped: number;
    existingEmails: string[];
    toInsertActive: number;
    toInsertSuppressed: number;
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

export function parseBeehiivUtcTimestamp(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(" UTC", "Z").replace(" ", "T");
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms);
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

    let rawSlug = slugFromBeehiivUrl(row.url);
    if (!rawSlug) {
      rawSlug = beehiivId.slice(0, 8);
    }
    const slugRules = applyBeehiivSlugRules(rawSlug);

    parsed.push({
      beehiivId,
      title: (row.web_title ?? row.title ?? "Untitled").trim() || "Untitled",
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

export type SubscriberPlanRow = {
  email: string;
  status: "active" | "inactive" | "pending" | "other";
  subscribedAt: Date | null;
  unsubscribedAt: Date | null;
};

export function parseBeehiivSubscriberRow(
  row: Record<string, string>,
): SubscriberPlanRow | null {
  const rawEmail = (row.email ?? "").trim();
  if (!rawEmail) {
    return null;
  }
  const email = rawEmail.toLowerCase();
  const status = (row.status ?? "").trim().toLowerCase();
  if (status === "pending") {
    return { email, status: "pending", subscribedAt: null, unsubscribedAt: null };
  }
  if (status === "active") {
    return {
      email,
      status: "active",
      subscribedAt: parseBeehiivUtcTimestamp(row.created_at ?? ""),
      unsubscribedAt: null,
    };
  }
  if (status === "inactive") {
    return {
      email,
      status: "inactive",
      subscribedAt: parseBeehiivUtcTimestamp(row.created_at ?? ""),
      unsubscribedAt: parseBeehiivUtcTimestamp(row.unsubscribed_at ?? ""),
    };
  }
  return { email, status: "other", subscribedAt: null, unsubscribedAt: null };
}

export function countBeehiivSubscriberStatuses(content: string): {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  other: number;
} {
  const { rows } = parseCsvRows(content);
  let active = 0;
  let inactive = 0;
  let pending = 0;
  let other = 0;

  for (const row of rows) {
    const parsed = parseBeehiivSubscriberRow(row);
    if (!parsed) {
      other += 1;
      continue;
    }
    if (parsed.status === "active") active += 1;
    else if (parsed.status === "inactive") inactive += 1;
    else if (parsed.status === "pending") pending += 1;
    else other += 1;
  }

  return { total: rows.length, active, inactive, pending, other };
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

async function migratePostImages(input: {
  html: string;
  live: boolean;
  fetchFn: FetchLike;
  uploadFn?: UploadImageFn;
  urlMapping: Map<string, string>;
  onUpload?: () => void;
  onSkipped?: () => void;
  onFailure?: (url: string) => void;
}): Promise<string> {
  const urls = extractBeehiivImageUrls(input.html);
  for (const sourceUrl of urls) {
    if (input.urlMapping.has(sourceUrl)) {
      input.onSkipped?.();
      continue;
    }

    if (!input.live) {
      continue;
    }

    if (!input.uploadFn) {
      input.onFailure?.(sourceUrl);
      continue;
    }

    try {
      const response = await input.fetchFn(sourceUrl);
      if (!response.ok) {
        input.onFailure?.(sourceUrl);
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
      const hash = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16);
      const ext = extensionFromContentType(contentType);
      const uploaded = await input.uploadFn(bytes, `beehiiv-${hash}.${ext}`, contentType);
      input.urlMapping.set(sourceUrl, uploaded.gatewayUrl);
      input.onUpload?.();
    } catch {
      input.onFailure?.(sourceUrl);
    }
  }

  return rewriteHtmlImageUrls(input.html, input.urlMapping);
}

export async function runBeehiivImport(input: {
  db: DearCreativeDb;
  databaseUrl: string;
  postsCsv: string;
  subscribersCsv: string;
  live: boolean;
  fetchFn?: FetchLike;
  uploadFn?: UploadImageFn;
}): Promise<BeehiivImportSummary> {
  const fetchFn = input.fetchFn ?? fetch;
  const postStatusCounts = countBeehiivPostStatuses(input.postsCsv);
  const subscriberStatusCounts = countBeehiivSubscriberStatuses(
    input.subscribersCsv,
  );
  const parsedPosts = parseBeehiivPosts(input.postsCsv);
  const slugRenamed = parsedPosts.filter((row) => row.slug === "welcome-2023").length;

  const importSlugs = parsedPosts.map((row) => row.slug);
  const slugCollisionsAmongImport = findSlugCollisions(importSlugs);

  const existingPosts = await input.db
    .select({
      slug: posts.slug,
      sourceGuid: posts.sourceGuid,
    })
    .from(posts);
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

  const subscriberRows = parseCsvRows(input.subscribersCsv).rows;
  let activeImported = 0;
  let suppressedStored = 0;
  let pendingSkipped = 0;
  let invalidSkipped = 0;
  let toInsertActive = 0;
  let toInsertSuppressed = 0;
  const existingEmails: string[] = [];

  const emailsToCheck: string[] = [];
  for (const row of subscriberRows) {
    const parsed = parseBeehiivSubscriberRow(row);
    if (!parsed) {
      invalidSkipped += 1;
      continue;
    }
    if (parsed.status === "pending") {
      pendingSkipped += 1;
      continue;
    }
    if (parsed.status === "other") {
      invalidSkipped += 1;
      continue;
    }
    if (!isValidEmail(parsed.email)) {
      invalidSkipped += 1;
      continue;
    }
    if (parsed.status === "active") {
      activeImported += 1;
    } else if (parsed.status === "inactive") {
      suppressedStored += 1;
    }
    emailsToCheck.push(parsed.email);
  }

  let existingEmailSet = new Set<string>();
  if (emailsToCheck.length > 0) {
    const existing = await input.db
      .select({ email: subscribers.email })
      .from(subscribers)
      .where(inArray(subscribers.email, emailsToCheck));
    existingEmailSet = new Set(existing.map((row) => row.email));
  }

  for (const row of subscriberRows) {
    const parsed = parseBeehiivSubscriberRow(row);
    if (!parsed || parsed.status === "pending" || parsed.status === "other") {
      continue;
    }
    if (!isValidEmail(parsed.email)) {
      continue;
    }
    if (existingEmailSet.has(parsed.email)) {
      existingEmails.push(parsed.email);
      continue;
    }
    if (parsed.status === "active") {
      toInsertActive += 1;
    } else if (parsed.status === "inactive") {
      toInsertSuppressed += 1;
    }
  }

  let writesPerformed = false;

  if (input.live) {
    for (const row of postsToInsert) {
      const bodyHtml = await migratePostImages({
        html: row.bodyHtml,
        live: true,
        fetchFn,
        uploadFn: input.uploadFn,
        urlMapping,
        onUpload: () => {
          imagesUploaded += 1;
        },
        onSkipped: () => {
          imagesSkippedMapped += 1;
        },
        onFailure: (url) => {
          imageUploadFailures.push(url);
        },
      });

      await input.db.insert(posts).values({
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
      writesPerformed = true;
    }

    for (const row of subscriberRows) {
      const parsed = parseBeehiivSubscriberRow(row);
      if (!parsed || parsed.status === "pending" || parsed.status === "other") {
        continue;
      }
      if (!isValidEmail(parsed.email)) {
        continue;
      }
      if (existingEmailSet.has(parsed.email)) {
        continue;
      }

      if (parsed.status === "active") {
        await input.db.insert(subscribers).values({
          id: randomUUID(),
          email: parsed.email,
          status: "subscribed",
          source: "beehiiv_import",
          subscribedAt: parsed.subscribedAt ?? new Date(),
        });
        writesPerformed = true;
      } else if (parsed.status === "inactive") {
        await input.db.insert(subscribers).values({
          id: randomUUID(),
          email: parsed.email,
          status: "unsubscribed",
          source: "beehiiv_import",
          subscribedAt: parsed.subscribedAt,
          unsubscribedAt: parsed.unsubscribedAt ?? parsed.subscribedAt ?? new Date(),
        });
        writesPerformed = true;
      }
    }
  }

  return {
    mode: input.live ? "live" : "dry-run",
    databaseUrl: input.databaseUrl,
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
    },
    subscribers: {
      csvRows: subscriberStatusCounts.total,
      activeImported,
      suppressedStored,
      pendingSkipped,
      invalidSkipped,
      existingEmails,
      toInsertActive,
      toInsertSuppressed,
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
