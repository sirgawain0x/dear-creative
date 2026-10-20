import { describe, expect, it } from "vitest";
import { readerStoredNarrationLabel } from "./dispatch-audio-reader-label";

describe("readerStoredNarrationLabel", () => {
  it("shows Kokoro for Kokoro voice ids", () => {
    expect(readerStoredNarrationLabel("af_heart")).toBe("Kokoro");
    expect(readerStoredNarrationLabel(null)).toBe("Kokoro");
  });

  it("passes through other stored voice names", () => {
    expect(readerStoredNarrationLabel("Puck")).toBe("Puck");
  });
});
