import { describe, expect, it } from "vitest";
import {
  getPublishedPostBySlug,
  listPublishedPosts,
  listRecentPublishedPosts,
} from "./published-posts";
import {
  createPostsTestDb,
  insertPost,
} from "./test-support/posts-test-db";

describe("published posts queries", () => {
  it("returns only published rows with published_at set, newest first", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "older",
      title: "Older",
      status: "published",
      publishedAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    await insertPost(db, {
      slug: "newer",
      title: "Newer",
      status: "published",
      publishedAt: new Date("2025-06-01T00:00:00.000Z"),
    });
    await insertPost(db, {
      slug: "draft-hidden",
      title: "Draft",
      status: "draft",
      publishedAt: null,
    });
    await insertPost(db, {
      slug: "smoke-published-at-null",
      title: "Smoke",
      status: "published",
      publishedAt: null,
    });

    const asOf = new Date("2026-01-01T00:00:00.000Z");
    const recent = await listRecentPublishedPosts(db, 10, { asOf });
    expect(recent.map((p) => p.slug)).toEqual(["newer", "older"]);
  });

  it("excludes drafts and future-dated scheduled publishes", async () => {
    const db = await createPostsTestDb();
    const asOf = new Date("2024-06-15T00:00:00.000Z");

    await insertPost(db, {
      slug: "live-now",
      title: "Live",
      status: "published",
      publishedAt: new Date("2024-06-01T00:00:00.000Z"),
    });
    await insertPost(db, {
      slug: "scheduled-future",
      title: "Scheduled",
      status: "published",
      publishedAt: new Date("2024-07-01T00:00:00.000Z"),
    });
    await insertPost(db, {
      slug: "draft-only",
      title: "Draft",
      status: "draft",
      publishedAt: null,
    });

    const recent = await listRecentPublishedPosts(db, 10, { asOf });
    expect(recent.map((p) => p.slug)).toEqual(["live-now"]);
  });

  it("derives reading time from full bodyHtml without exposing it on list items", async () => {
    const db = await createPostsTestDb();
    const longBody = `<p>${"word ".repeat(400)}</p>`;
    await insertPost(db, {
      slug: "long-paid-body",
      title: "Long paid",
      status: "published",
      publishedAt: new Date("2024-06-01T00:00:00.000Z"),
      teaserText: null,
      freeContent: null,
      bodyHtml: longBody,
    });

    const [item] = await listRecentPublishedPosts(db, 1);
    expect(item).toBeDefined();
    expect(item).not.toHaveProperty("bodyHtml");
    expect(item?.readMinutes).toBeGreaterThan(1);
  });

  it("resolves list cover from bodyHtml for paid posts without preview images", async () => {
    const db = await createPostsTestDb();
    const papyrus =
      "https://storage.googleapis.com/papyrus_images/1561f2d41303599b84b0b17bec1b224df57d01b39a51109b25adec70bfe7896c.png";
    await insertPost(db, {
      slug: "papyrus-body-cover",
      title: "Papyrus hero",
      status: "published",
      publishedAt: new Date("2024-06-01T00:00:00.000Z"),
      teaserText: "Teaser only",
      freeContent: null,
      bodyHtml: `<p>Paid</p><img src="${papyrus}" alt="Cover" />`,
    });

    const [item] = await listRecentPublishedPosts(db, 1);
    expect(item?.coverImage).toBe(papyrus);
    expect(item).not.toHaveProperty("bodyHtml");
  });

  it("does not expose bodyHtml on list items", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "public-list-item",
      title: "Public",
      status: "published",
      publishedAt: new Date("2024-06-01T00:00:00.000Z"),
      teaserText: null,
      bodyHtml: "<p>paid body must not leak</p>",
      freeContent: "Free preview only",
    });

    const [item] = await listRecentPublishedPosts(db, 1);
    expect(item).toBeDefined();
    expect(item).not.toHaveProperty("bodyHtml");
    expect(item?.teaser).toBe("Free preview only");
    expect(JSON.stringify(item)).not.toContain("paid body");
  });

  it("paginates published posts", async () => {
    const db = await createPostsTestDb();
    for (let i = 0; i < 5; i += 1) {
      await insertPost(db, {
        slug: `post-${i}`,
        title: `Post ${i}`,
        status: "published",
        publishedAt: new Date(`2024-01-0${i + 1}T00:00:00.000Z`),
      });
    }

    const page1 = await listPublishedPosts(db, { page: 1, pageSize: 2 });
    expect(page1.totalCount).toBe(5);
    expect(page1.totalPages).toBe(3);
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0]?.slug).toBe("post-4");

    const page2 = await listPublishedPosts(db, { page: 2, pageSize: 2 });
    expect(page2.items.map((p) => p.slug)).toEqual(["post-2", "post-1"]);
  });

  it("includes Beehiiv-import-shaped rows with null author_id in public lists", async () => {
    const db = await createPostsTestDb();
    const asOf = new Date("2026-06-01T00:00:00.000Z");

    await insertPost(db, {
      slug: "newer-paragraph",
      title: "Newer",
      status: "published",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "paragraph",
    });
    await insertPost(db, {
      slug: "beehiiv-archive-issue",
      title: "Beehiiv archive",
      status: "published",
      publishedAt: new Date("2023-06-01T00:00:00.000Z"),
      authorId: null,
      source: "beehiiv",
      sourceGuid: "beehiiv:pub-archive-1",
      canonicalUrl: "https://dearcrtv.beehiiv.com/p/beehiiv-archive-issue",
    });

    const recent = await listRecentPublishedPosts(db, 20, { asOf });
    expect(recent.map((p) => p.slug)).toEqual([
      "newer-paragraph",
      "beehiiv-archive-issue",
    ]);

    const page = await listPublishedPosts(db, { page: 1, pageSize: 10, asOf });
    expect(page.totalCount).toBe(2);
    expect(page.items.some((p) => p.slug === "beehiiv-archive-issue")).toBe(true);
  });

  it("returns null for draft slug (404 path)", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "secret-draft",
      title: "Secret",
      status: "draft",
      publishedAt: null,
      bodyHtml: "<p>hidden</p>",
    });

    const found = await getPublishedPostBySlug(db, "secret-draft");
    expect(found).toBeNull();
  });
});
