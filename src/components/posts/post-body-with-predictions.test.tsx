/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const Q =
  "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const fetchMock = vi.fn(async (questionId: string, viewUrl: string) => ({
  ok: true as const,
  questionId,
  viewUrl,
  title: "Will it rain?",
  outcomes: ["No", "Yes"],
  category: "general",
  status: "open" as const,
  resultLabel: null,
  minBondWei: "1000000000000000",
  bondWei: "0",
  openingTs: 1_700_000_000,
}));

vi.mock("@/lib/predictions/fetch-prediction-embed", () => ({
  fetchPredictionEmbedCached: (questionId: string, viewUrl: string) =>
    fetchMock(questionId, viewUrl),
}));

import { PostBodyWithPredictions } from "./post-body-with-predictions";

describe("PostBodyWithPredictions", () => {
  it("fetches chain data for pre-existing embed placeholders from markdown", async () => {
    const bodyHtml = [
      "<p>Intro paragraph.</p>",
      `<div class="dear-prediction-embed" data-question-id="${Q}" data-view-url="https://tv.creativeplatform.xyz/predict/${Q}"></div>`,
      "<p>Closing paragraph.</p>",
    ].join("\n");

    render(await PostBodyWithPredictions({ bodyHtml }));

    expect(fetchMock).toHaveBeenCalledWith(
      Q,
      `https://tv.creativeplatform.xyz/predict/${Q}`,
    );
    // The card renders the fetched title instead of the plain fallback link.
    expect(screen.getByText(/Will it rain\?/)).toBeTruthy();
    expect(screen.queryByText(/View prediction on Creative TV/)).toBeNull();
  });
});
