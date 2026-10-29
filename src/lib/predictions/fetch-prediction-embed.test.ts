import { describe, expect, it } from "vitest";
import {
  fetchPredictionEmbed,
  type PredictionEmbedReader,
} from "./fetch-prediction-embed";

const Q =
  "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;

function mockReader(overrides?: Partial<PredictionEmbedReader>): PredictionEmbedReader {
  return {
    async getQuestionState() {
      return {
        questionText: `Will it rain?\u241f["No","Yes"]\u241fgeneral\u241fen_US`,
        templateId: 0,
        openingTs: 1_700_000_000,
        timeoutSec: 86_400,
        finalizeTs: 0,
        minBondWei: BigInt("1000000000000000"),
        bondWei: BigInt("2000000000000000"),
        bestAnswer:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
      };
    },
    async isFinalized() {
      return true;
    },
    async resultFor() {
      return "0x0000000000000000000000000000000000000000000000000000000000000001";
    },
    ...overrides,
  };
}

describe("fetch-prediction-embed", () => {
  it("returns parsed embed data from mocked reads", async () => {
    const viewUrl = `https://tv.creativeplatform.xyz/predict/${Q}`;
    const result = await fetchPredictionEmbed(Q, viewUrl, mockReader());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.title).toBe("Will it rain?");
      expect(result.status).toBe("finalized");
      expect(result.resultLabel).toBe("Yes");
      expect(result.minBondWei).toBe("1000000000000000");
    }
  });

  it("returns failure for RPC errors (caller falls back to link)", async () => {
    const viewUrl = `https://tv.creativeplatform.xyz/predict/${Q}`;
    const result = await fetchPredictionEmbed(
      Q,
      viewUrl,
      mockReader({
        async getQuestionState() {
          throw new Error("RPC unavailable");
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("marks bonding when not finalized but bond is active", async () => {
    const viewUrl = `https://tv.creativeplatform.xyz/predict/${Q}`;
    const result = await fetchPredictionEmbed(
      Q,
      viewUrl,
      mockReader({
        async isFinalized() {
          return false;
        },
        async resultFor() {
          return "0x0000000000000000000000000000000000000000000000000000000000000000";
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("bonding");
      expect(result.resultLabel).toBeNull();
    }
  });
});
