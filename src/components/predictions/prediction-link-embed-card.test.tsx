/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PredictionLinkEmbedCard } from "./prediction-link-embed-card";

const mockData = {
  ok: true as const,
  questionId:
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const,
  viewUrl:
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  title: "Will Creative TV hit 1M views?",
  outcomes: ["No", "Yes"],
  category: "general",
  status: "bonding" as const,
  resultLabel: null,
  minBondWei: "1000000000000000",
  bondWei: "2000000000000000",
  openingTs: 1_700_000_000,
  timeoutSec: 86_400,
  finalizeTs: null,
};

describe("PredictionLinkEmbedCard", () => {
  it("renders mocked bonding state", () => {
    render(
      <PredictionLinkEmbedCard
        data={{
          ...mockData,
          viewUrl: "https://tv.creativeplatform.xyz/predict/0xee",
        }}
        viewUrl="https://tv.creativeplatform.xyz/predict/0xee"
      />,
    );
    expect(screen.getByTestId("prediction-link-embed-card")).toBeTruthy();
    expect(screen.getByText("Will Creative TV hit 1M views?")).toBeTruthy();
    expect(screen.getByText("Bonding")).toBeTruthy();
    expect(screen.getByText("View on Creative TV ↗")).toBeTruthy();
  });

  it("renders fallback link when data is missing", () => {
    render(
      <PredictionLinkEmbedCard
        data={null}
        viewUrl="https://tv.creativeplatform.xyz/predict/0xee"
        fallbackLink
      />,
    );
    expect(screen.getByText("View prediction on Creative TV ↗")).toBeTruthy();
  });
});
