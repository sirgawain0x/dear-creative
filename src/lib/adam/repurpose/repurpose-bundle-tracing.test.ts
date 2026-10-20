import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("repurpose route output tracing", () => {
  it("includes bundled fonts in outputFileTracingIncludes for the repurpose API route", async () => {
    const configSource = await readFile(
      `${process.cwd()}/next.config.ts`,
      "utf8",
    );
    expect(configSource).toContain('"/api/adam/posts/*/repurpose/*"');
    expect(configSource).toContain("./src/assets/fonts/**/*");
  });
});
