import { describe, expect, it } from "vitest";
import {
  answerBytesToLabel,
  parsePredictionDisplay,
} from "./parse-prediction-display";

describe("parse-prediction-display", () => {
  it("parses unit-separator bool questions", () => {
    const raw = `Will the demo resolve?\u241f["No","Yes"]\u241feditorial\u241fen_US`;
    const parsed = parsePredictionDisplay(raw, 0);
    expect(parsed.title).toBe("Will the demo resolve?");
    expect(parsed.outcomes).toEqual(["No", "Yes"]);
    expect(parsed.type).toBe("bool");
  });

  it("maps finalized bool answers to labels", () => {
    const parsed = parsePredictionDisplay("Demo?\u241f[\"No\",\"Yes\"]\u241fgeneral\u241fen_US", 0);
    expect(
      answerBytesToLabel(
        "0x0000000000000000000000000000000000000000000000000000000000000001",
        parsed,
      ),
    ).toBe("Yes");
  });
});
