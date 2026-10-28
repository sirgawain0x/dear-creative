import { describe, expect, it } from "vitest";
import { isMissingColumnError } from "./sqlite-errors";

function drizzleWrappedSqliteError(sqliteMessage: string): Error {
  const cause = new Error(sqliteMessage);
  const outer = new Error("Failed query: select tagline from authors limit ?");
  outer.cause = cause;
  return outer;
}

describe("isMissingColumnError", () => {
  it("matches no such column on a nested Drizzle/libsql cause", () => {
    const error = drizzleWrappedSqliteError(
      "SQLITE_ERROR: no such column: tagline",
    );
    expect(isMissingColumnError(error)).toBe(true);
  });

  it("returns false for unrelated wrapped errors", () => {
    const cause = new Error("SQLITE_ERROR: database disk image is malformed");
    const outer = new Error("Failed query: select tagline from authors limit ?");
    outer.cause = cause;
    expect(isMissingColumnError(outer)).toBe(false);
  });

  it("guards cyclic cause chains", () => {
    const a = new Error("outer");
    const b = new Error("SQLITE_ERROR: no such column: tagline");
    a.cause = b;
    b.cause = a;
    expect(isMissingColumnError(a)).toBe(true);
  });
});
