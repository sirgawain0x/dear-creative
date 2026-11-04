import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const drizzleDir = join(process.cwd(), "drizzle");

describe("0025_subscriber_signup_src migration", () => {
  it("adds nullable signup_src column only", () => {
    const sql = readFileSync(
      join(drizzleDir, "0025_subscriber_signup_src.sql"),
      "utf8",
    );
    expect(sql).toContain("ADD `signup_src` text");
    expect(sql).not.toContain("UPDATE `subscribers`");
  });
});
