import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NEWSLETTER_POSTAL_ADDRESS } from "@/components/site-footer";

describe("homepage source layout", () => {
  it("does not render the postal address in the homepage module (footer only)", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "src/app/page.tsx"),
      "utf8",
    );
    expect(pageSource).not.toContain("NEWSLETTER_POSTAL_ADDRESS");
    expect(pageSource).not.toContain(NEWSLETTER_POSTAL_ADDRESS);
  });
});
