import { parseCsvRecords } from "./csv";

const BEEHIIV_PUBLISHED = new Set(["confirmed", "published"]);

export function slugFromBeehiivUrl(url: string | null | undefined): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.pathname.replace(/\/+$/, "").split("/").pop()?.trim() ?? "";
  } catch {
    return "";
  }
}

export function applyWelcomeSlugRename(slug: string): string {
  return slug === "welcome" ? "welcome-2023" : slug;
}

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug.length > 0 ? slug : "untitled";
}

/** Maps Beehiiv /p/<beehiiv-slug> segment → Dear Creative post slug. */
export function buildBeehiivSlugMapFromPostsCsv(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const records = parseCsvRecords(content);
  if (records.length < 2) {
    return map;
  }
  const headers = records[0]!.map((h) => h.replace(/^\uFEFF/, "").trim());
  const idx = (name: string) => headers.indexOf(name);

  for (const cells of records.slice(1)) {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? "";
    });
    const status = (row.status ?? "").trim().toLowerCase();
    if (!BEEHIIV_PUBLISHED.has(status)) {
      continue;
    }
    const title = (row.web_title ?? row.title ?? "").trim() || "Untitled";
    let beehiivSlug = slugFromBeehiivUrl(row.url);
    if (!beehiivSlug) {
      beehiivSlug = slugifyTitle(title);
    }
    const ourSlug = applyWelcomeSlugRename(beehiivSlug);
    map.set(beehiivSlug, ourSlug);
    if (beehiivSlug !== ourSlug) {
      map.set(ourSlug, ourSlug);
    }
  }

  return map;
}

export type DbBeehiivPost = {
  id: string;
  slug: string;
  sourceGuid: string;
  bodyHtml: string | null;
};

export function buildBeehiivSlugMapFromDbPosts(
  posts: DbBeehiivPost[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const post of posts) {
    map.set(post.slug, post.slug);
  }
  return map;
}

/** Resolve Beehiiv URL path slug using canonical URL stored on import when available. */
export function enrichSlugMapFromDbCanonicals(
  map: Map<string, string>,
  posts: Array<{ slug: string; canonicalUrl: string | null }>,
): void {
  for (const post of posts) {
    const beehiivSlug = slugFromBeehiivUrl(post.canonicalUrl);
    if (beehiivSlug) {
      map.set(beehiivSlug, post.slug);
    }
  }
}
