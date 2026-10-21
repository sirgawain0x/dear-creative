import { describe, expect, it } from "vitest";
import { parseImportBeehiivArgs } from "./parse-import-args";

describe("parseImportBeehiivArgs", () => {
  it("parses prod, live, confirm, and csv paths", () => {
    const parsed = parseImportBeehiivArgs([
      "--prod",
      "--live",
      "--confirm",
      "IMPORT TO PROD",
      "posts.csv",
      "subs.csv",
    ]);
    expect(parsed).toEqual({
      prod: true,
      live: true,
      prodLiveConfirmation: "IMPORT TO PROD",
      postsPath: "posts.csv",
      subscribersPath: "subs.csv",
    });
  });
});
