import { describe, expect, it } from "vitest";
import { validateRepurposeModelOutput } from "./validate-output";

describe("validateRepurposeModelOutput quiz", () => {
  it("rejects correctIndex outside choices length", () => {
    expect(() =>
      validateRepurposeModelOutput("quiz", {
        title: "Quiz",
        questions: [
          {
            prompt: "Pick one",
            choices: ["A", "B"],
            correctIndex: 2,
            explanation: "Because",
          },
        ],
      }),
    ).toThrow();
  });
});
