import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

vi.mock("next/cache", () => ({
  cacheLife: () => undefined,
  cacheTag: () => undefined,
}));

import { getDb } from "@/db/client";
import { getCachedPublishedPostExists } from "./published-posts-cache";
import * as publishedPosts from "./published-posts";

describe("getCachedPublishedPostExists", () => {
  beforeEach(async () => {
    const client = createClient({ url: ":memory:" });
    const db = drizzle(client, { schema });
    vi.mocked(getDb).mockReturnValue(db);
    await client.execute(`
      CREATE TABLE posts (
        id text PRIMARY KEY NOT NULL,
        slug text NOT NULL UNIQUE,
        title text NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        published_at integer,
        teaser_text text,
        email_subject text,
        email_html text,
        body_html text,
        is_gated integer NOT NULL DEFAULT 0,
        created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
      );
    `);
  });

  it("returns true immediately when cache says false but DB now has the post", async () => {
    vi.spyOn(publishedPosts, "existsPublishedPostBySlug")
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(getCachedPublishedPostExists("just-published")).resolves.toBe(
      true,
    );
  });
});
