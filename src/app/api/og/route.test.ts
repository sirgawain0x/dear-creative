import { describe, expect, it } from "vitest";
import {
  MAX_OG_TITLE_LENGTH,
  truncateOgTitleForImage,
} from "./route";

describe("truncateOgTitleForImage", () => {
  it("leaves short titles unchanged", () => {
    expect(truncateOgTitleForImage("Hello")).toBe("Hello");
  });

  it(`caps titles at ${MAX_OG_TITLE_LENGTH} characters on the OG route`, () => {
    const long = "B".repeat(200);
    const truncated = truncateOgTitleForImage(long);
    expect(truncated.length).toBeLessThanOrEqual(MAX_OG_TITLE_LENGTH);
    expect(truncated.endsWith("…")).toBe(true);
    expect(truncated).toBe(`${"B".repeat(MAX_OG_TITLE_LENGTH - 1)}…`);
  });
});
