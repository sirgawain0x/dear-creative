import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  getAuthorProfileById,
  listPublishedArticlesForAuthor,
} from "./author-profile";

describe("author profile posts", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    client = createClient({ url: ":memory:" });
    db = drizzle(client, { schema });
    await client.execute(`
      CREATE TABLE authors (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        slug text NOT NULL,
        bio text,
        tagline text,
        avatar_url text,
        payout_address text NOT NULL,
        me_token_address text,
        me_token_symbol text,
        created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE UNIQUE INDEX authors_slug_unique ON authors (slug);
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
        split_address_override text,
        created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);
    await db.insert(schema.authors).values({
      id: "author-1",
      name: "Ada Lovelace",
      slug: "ada",
      payoutAddress: "0x0000000000000000000000000000000000000001",
    });
  });

  afterEach(() => {
    // in-memory db discarded each test
  });

  it("lists published posts authored by the writer", async () => {
    await db.insert(schema.posts).values([
      {
        id: "p1",
        slug: "first-post",
        title: "First",
        authorId: "author-1",
        status: "published",
        publishedAt: new Date("2026-01-01T12:00:00Z"),
      },
      {
        id: "p2",
        slug: "draft-post",
        title: "Draft",
        authorId: "author-1",
        status: "draft",
      },
    ]);

    const articles = await listPublishedArticlesForAuthor(db, "author-1");
    expect(articles).toHaveLength(1);
    expect(articles[0]?.slug).toBe("first-post");
    expect(articles[0]?.role).toBe("author");
  });

  it("includes co-written posts when post_writers exists", async () => {
    await client.execute(`
      CREATE TABLE post_writers (
        id text PRIMARY KEY NOT NULL,
        post_id text NOT NULL,
        writer_id text,
        invite_id text,
        role text NOT NULL,
        share_bps integer NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        created_at integer NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);
    await db.insert(schema.posts).values([
      {
        id: "solo",
        slug: "solo",
        title: "Solo",
        authorId: "author-1",
        status: "published",
        publishedAt: new Date("2026-02-01T12:00:00Z"),
      },
      {
        id: "collab",
        slug: "collab",
        title: "Collab",
        authorId: "other-author",
        status: "published",
        publishedAt: new Date("2026-02-02T12:00:00Z"),
      },
    ]);
    await client.execute(
      `INSERT INTO post_writers (id, post_id, writer_id, role, share_bps, status)
       VALUES ('pw1', 'collab', 'author-1', 'cowriter', 5000, 'accepted')`,
    );

    const articles = await listPublishedArticlesForAuthor(db, "author-1");
    expect(articles.map((a) => a.slug).sort()).toEqual(["collab", "solo"]);
    const collab = articles.find((a) => a.slug === "collab");
    expect(collab?.role).toBe("cowriter");
  });

  it("loads profile without avatar column", async () => {
    const client = createClient({ url: ":memory:" });
    const legacyDb = drizzle(client, { schema });
    await client.execute(`
      CREATE TABLE authors (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        slug text NOT NULL,
        bio text,
        payout_address text NOT NULL,
        created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);
    await client.execute(
      `INSERT INTO authors (id, name, slug, payout_address) VALUES ('legacy', 'Legacy Author', 'legacy', '0x1')`,
    );

    const profile = await getAuthorProfileById(legacyDb, "legacy");
    expect(profile?.name).toBe("Legacy Author");
    expect(profile?.avatarUrl).toBeNull();
  });
});
