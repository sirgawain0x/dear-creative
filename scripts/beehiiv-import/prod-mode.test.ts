import { describe, expect, it } from "vitest";
import {
  assertProdLiveConfirmationPhrase,
  PROD_LIVE_CONFIRMATION_PHRASE,
  safeDatabaseHost,
} from "./prod-mode";

describe("prod-mode", () => {
  it("prints host only for Turso URLs (no credentials in output shape)", () => {
    expect(
      safeDatabaseHost("libsql://dear-creative-myorg.turso.io"),
    ).toBe("dear-creative-myorg.turso.io");
    expect(safeDatabaseHost("file:./data/local.db")).toBe("file:local");
  });

  it("requires exact confirmation phrase for prod live", () => {
    expect(() =>
      assertProdLiveConfirmationPhrase(PROD_LIVE_CONFIRMATION_PHRASE),
    ).not.toThrow();
    expect(() => assertProdLiveConfirmationPhrase("import to prod")).toThrow(
      /Refusing --prod --live/,
    );
  });
});
