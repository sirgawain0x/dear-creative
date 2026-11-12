import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const drizzleDir = join(process.cwd(), "drizzle");

describe("0026_adam_chat_thread_owner migration", () => {
  it("adds owner_user_id column and index without auto-backfill", () => {
    const sql = readFileSync(
      join(drizzleDir, "0026_adam_chat_thread_owner.sql"),
      "utf8",
    );
    expect(sql).toContain("ADD `owner_user_id` text");
    expect(sql).toContain("adam_chat_threads_owner_user_id_idx");
    expect(sql).not.toContain("UPDATE `adam_chat_threads`");
  });
});
