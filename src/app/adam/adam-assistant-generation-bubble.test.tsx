/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdamAssistantGenerationBubble } from "./adam-assistant-generation-bubble";
import { AdamStreamingCue } from "./adam-streaming-cue";
import { AdamThinkingIndicator } from "./adam-thinking-indicator";

describe("AdamAssistantGenerationBubble", () => {
  afterEach(() => {
    cleanup();
  });

  it("waiting shows the thinking indicator", () => {
    render(
      <AdamAssistantGenerationBubble phase="waiting" content="" />,
    );
    expect(screen.getByTestId("adam-thinking-indicator")).toBeInTheDocument();
    expect(
      screen.getByTestId("adam-assistant-generation-bubble"),
    ).toHaveAttribute("data-generation-phase", "waiting");
  });

  it("streaming shows partial content and streaming cue", () => {
    render(
      <AdamAssistantGenerationBubble
        phase="streaming"
        content="Partial reply"
      />,
    );
    expect(screen.getByText(/Partial reply/)).toBeInTheDocument();
    expect(screen.getByTestId("adam-streaming-cue")).toBeInTheDocument();
  });

  it("done state: no generation bubble when studio is idle (indicator standalone)", () => {
    render(<AdamThinkingIndicator reducedMotion />);
    expect(screen.getByTestId("adam-thinking-indicator")).toHaveAttribute(
      "aria-label",
      "Adam is thinking",
    );
  });

  it("error state: streaming cue component remains available for reuse", () => {
    render(<AdamStreamingCue reducedMotion />);
    expect(screen.getByTestId("adam-streaming-cue")).toBeInTheDocument();
  });
});
