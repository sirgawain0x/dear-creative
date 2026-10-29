// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  sampleDataTable,
  sampleFlashcards,
  sampleMindMap,
  sampleQuiz,
  sampleReport,
  sampleSlideDeck,
} from "@/lib/adam/repurpose/fixtures/sample-payloads";
import { RepurposeOutputCard } from "./repurpose-output-views";

describe("RepurposeOutputCard", () => {
  it("renders mind map labels", () => {
    render(
      <RepurposeOutputCard
        output={{
          id: "1",
          postId: "p",
          outputType: "mind_map",
          status: "ready",
          payload: sampleMindMap,
          mediaUrl: null,
          mediaMimeType: null,
          errorMessage: null,
          createdAt: "",
          updatedAt: "",
        }}
      />,
    );
    expect(screen.getByText("Core idea")).toBeInTheDocument();
    expect(screen.getByText("Branch A")).toBeInTheDocument();
  });

  it("renders report sections", () => {
    render(
      <RepurposeOutputCard
        output={{
          id: "1",
          postId: "p",
          outputType: "report",
          status: "ready",
          payload: sampleReport,
          mediaUrl: null,
          mediaMimeType: null,
          errorMessage: null,
          createdAt: "",
          updatedAt: "",
        }}
      />,
    );
    expect(screen.getByText("Briefing")).toBeInTheDocument();
    expect(screen.getByText("Key takeaways")).toBeInTheDocument();
  });

  it("renders slide deck bullets", () => {
    render(
      <RepurposeOutputCard
        output={{
          id: "1",
          postId: "p",
          outputType: "slide_deck",
          status: "ready",
          payload: sampleSlideDeck,
          mediaUrl: null,
          mediaMimeType: null,
          errorMessage: null,
          createdAt: "",
          updatedAt: "",
        }}
      />,
    );
    expect(screen.getByText(/Slide 1/)).toBeInTheDocument();
    expect(screen.getByText("Point")).toBeInTheDocument();
  });

  it("renders flashcards", () => {
    render(
      <RepurposeOutputCard
        output={{
          id: "1",
          postId: "p",
          outputType: "flashcards",
          status: "ready",
          payload: sampleFlashcards,
          mediaUrl: null,
          mediaMimeType: null,
          errorMessage: null,
          createdAt: "",
          updatedAt: "",
        }}
      />,
    );
    expect(screen.getByText("Q")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders quiz with correct choice marked", () => {
    render(
      <RepurposeOutputCard
        output={{
          id: "1",
          postId: "p",
          outputType: "quiz",
          status: "ready",
          payload: sampleQuiz,
          mediaUrl: null,
          mediaMimeType: null,
          errorMessage: null,
          createdAt: "",
          updatedAt: "",
        }}
      />,
    );
    expect(screen.getByText(/Right ✓/)).toBeInTheDocument();
  });

  it("renders data table cells", () => {
    render(
      <RepurposeOutputCard
        output={{
          id: "1",
          postId: "p",
          outputType: "data_table",
          status: "ready",
          payload: sampleDataTable,
          mediaUrl: null,
          mediaMimeType: null,
          errorMessage: null,
          createdAt: "",
          updatedAt: "",
        }}
      />,
    );
    expect(screen.getByText("Col A")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("falls back gracefully on malformed payload", () => {
    render(
      <RepurposeOutputCard
        output={{
          id: "1",
          postId: "p",
          outputType: "mind_map",
          status: "ready",
          payload: { broken: true },
          mediaUrl: null,
          mediaMimeType: null,
          errorMessage: null,
          createdAt: "",
          updatedAt: "",
        }}
      />,
    );
    expect(screen.getByText(/could not be displayed/i)).toBeInTheDocument();
  });
});
