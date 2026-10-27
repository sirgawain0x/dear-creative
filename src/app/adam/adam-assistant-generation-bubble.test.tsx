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

  it("done state: thinking indicator is decorative (no duplicate live region)", () => {
    render(<AdamThinkingIndicator reducedMotion />);
    const indicator = screen.getByTestId("adam-thinking-indicator");
    expect(indicator).toHaveAttribute("aria-hidden", "true");
    expect(indicator).not.toHaveAttribute("role", "status");
  });

  it("error state: streaming cue component remains available for reuse", () => {
    render(<AdamStreamingCue reducedMotion />);
    expect(screen.getByTestId("adam-streaming-cue")).toBeInTheDocument();
  });
});
