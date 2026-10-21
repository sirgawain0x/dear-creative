import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { setAuthorProfilesEnabledForTests } from "@/lib/authors/feature-flag";

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/posts/published-posts-cache", () => ({
  getCachedPublishedPostExists: vi.fn(),
}));

import { getDb } from "@/db/client";
import { getCachedPublishedPostExists } from "@/lib/posts/published-posts-cache";
import * as publishedPosts from "@/lib/posts/published-posts";
import {
  NOT_FOUND_DOCUMENT_PATH,
  notFoundDocumentUrl,
  resolvePageNotFoundProxy,
} from "./page-not-found-proxy";

describe("resolvePageNotFoundProxy", () => {
  beforeEach(async () => {
    const client = createClient({ url: ":memory:" });
    const db = drizzle(client, { schema });
    vi.mocked(getDb).mockReturnValue(db);
    vi.mocked(getCachedPublishedPostExists).mockImplementation(async (slug) =>
      publishedPosts.existsPublishedPostBySlug(db, slug),
    );
    await client.execute(`
      CREATE TABLE authors (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        slug text NOT NULL,
        bio text,
        avatar_url text,
        payout_address text NOT NULL,
        me_token_address text,
        me_token_symbol text,
        created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);
    await client.execute(`
      CREATE TABLE posts (
        id text PRIMARY KEY NOT NULL,
        slug text NOT NULL UNIQUE,
        title text NOT NULL,
        author_id text,
        status text NOT NULL DEFAULT 'draft',
        published_at integer,
        teaser_text text,
        email_subject text,
        email_html text,
        body_html text,
        free_content text,
        gated_content text,
        is_gated integer NOT NULL DEFAULT 0,
        gate_price_usdc real,
        audio_url text,
        audio_voice text,
        canonical_url text,
        source_guid text,
        source text,
        sponsor_id text,
        created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
      );
    `);
    await db.insert(schema.posts).values({
      id: "p1",
      slug: "live-post",
      title: "Live",
      status: "published",
      publishedAt: new Date(),
      isGated: false,
    });
    await db.insert(schema.posts).values({
      id: "p-gated",
      slug: "gated-live-post",
      title: "Gated",
      status: "published",
      publishedAt: new Date(),
      isGated: true,
    });
    await db.insert(schema.authors).values({
      id: "a1",
      name: "Author",
      slug: "author",
      payoutAddress: "0x1",
    });
  });

  afterEach(() => {
    setAuthorProfilesEnabledForTests(undefined);
    vi.mocked(getCachedPublishedPostExists).mockReset();
  });

  it("returns next when the published-post lookup throws (fail open)", async () => {
    vi.mocked(getCachedPublishedPostExists).mockRejectedValueOnce(
      new Error("cache unavailable"),
    );
    vi.spyOn(publishedPosts, "existsPublishedPostBySlug").mockRejectedValueOnce(
      new Error("db unavailable"),
    );
    const result = await resolvePageNotFoundProxy("/posts/any-slug");
    expect(result).toEqual({ action: "next" });
  });

  it("returns next for index and nested paths without a single post slug", async () => {
    await expect(resolvePageNotFoundProxy("/posts")).resolves.toEqual({
      action: "next",
    });
    await expect(resolvePageNotFoundProxy("/posts/")).resolves.toEqual({
      action: "next",
    });
    await expect(resolvePageNotFoundProxy("/posts/live/extra")).resolves.toEqual(
      { action: "next" },
    );
    await expect(resolvePageNotFoundProxy("/authors")).resolves.toEqual({
      action: "next",
    });
    await expect(resolvePageNotFoundProxy("/authors/a1/extra")).resolves.toEqual(
      { action: "next" },
    );
  });

  it("returns next for a gated published post slug", async () => {
    const result = await resolvePageNotFoundProxy("/posts/gated-live-post");
    expect(result).toEqual({ action: "next" });
  });

  it("returns not_found for a missing post slug", async () => {
    const result = await resolvePageNotFoundProxy("/posts/missing-slug");
    expect(result).toEqual({ action: "not_found" });
    expect(notFoundDocumentUrl(new URL("http://localhost/posts/missing-slug")).pathname).toBe(
      NOT_FOUND_DOCUMENT_PATH,
    );
  });

  it("returns not_found for malformed post slugs without hitting the cache", async () => {
    const result = await resolvePageNotFoundProxy("/posts/NOT-VALID");
    expect(result).toEqual({ action: "not_found" });
    expect(getCachedPublishedPostExists).not.toHaveBeenCalled();
  });

  it("returns not_found for author profiles when the flag is off", async () => {
    setAuthorProfilesEnabledForTests(false);
    const result = await resolvePageNotFoundProxy("/authors/a1");
    expect(result).toEqual({ action: "not_found" });
  });

  it("returns not_found for a missing author when the flag is on", async () => {
    setAuthorProfilesEnabledForTests(true);
    const result = await resolvePageNotFoundProxy("/authors/missing-author");
    expect(result).toEqual({ action: "not_found" });
  });

  it("allows an existing published post slug", async () => {
    const result = await resolvePageNotFoundProxy("/posts/live-post");
    expect(result).toEqual({ action: "next" });
  });
});
