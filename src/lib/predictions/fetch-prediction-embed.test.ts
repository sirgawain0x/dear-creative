import { describe, expect, it } from "vitest";
import {
  createPredictionEmbedReaderFromClient,
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

  it("fails instead of fabricating a card when question text is missing", async () => {
    const viewUrl = `https://tv.creativeplatform.xyz/predict/${Q}`;
    const result = await fetchPredictionEmbed(
      Q,
      viewUrl,
      mockReader({
        async getQuestionState() {
          return {
            questionText: "",
            templateId: null,
            openingTs: 1_700_000_000,
            timeoutSec: 86_400,
            finalizeTs: 0,
            minBondWei: BigInt(0),
            bondWei: BigInt(0),
            bestAnswer:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
          };
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("marks open (not bonding) when past opening with no answers yet", async () => {
    const viewUrl = `https://tv.creativeplatform.xyz/predict/${Q}`;
    const result = await fetchPredictionEmbed(
      Q,
      viewUrl,
      mockReader({
        async getQuestionState() {
          return {
            questionText: `Will it rain?\u241f["No","Yes"]\u241fgeneral\u241fen_US`,
            templateId: 0,
            openingTs: 1_700_000_000,
            timeoutSec: 86_400,
            finalizeTs: 0,
            minBondWei: BigInt("1000000000000000"),
            bondWei: BigInt(0),
            bestAnswer:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
          };
        },
        async isFinalized() {
          return false;
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("open");
    }
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

const CONTRACT = "0x2F39f464d16402Ca3D8527dA89617b73DE2F60e8" as const;
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function questionTuple(contentHash: string) {
  return [
    contentHash,
    "0x0000000000000000000000000000000000000000",
    1_700_000_000,
    86_400,
    0,
    false,
    BigInt(0),
    ZERO_BYTES32,
    ZERO_BYTES32,
    BigInt("2000000000000000"),
    BigInt("1000000000000000"),
  ];
}

function mockChainClient(overrides?: {
  tuple?: unknown;
  logs?: Array<{ args?: Record<string, unknown> }>;
  logsError?: boolean;
}) {
  return {
    async readContract() {
      return overrides?.tuple ?? questionTuple(`0x${"ab".repeat(32)}`);
    },
    async getLogs() {
      if (overrides?.logsError) throw new Error("log scan failed");
      return (
        overrides?.logs ?? [
          {
            args: {
              question: `Will it rain?\u241f["No","Yes"]\u241fgeneral\u241fen_US`,
              template_id: BigInt(0),
            },
          },
        ]
      );
    },
  };
}

describe("createPredictionEmbedReaderFromClient", () => {
  it("treats a zero struct (unknown question id) as not found", async () => {
    const reader = createPredictionEmbedReaderFromClient(
      mockChainClient({ tuple: questionTuple(ZERO_BYTES32) }),
      CONTRACT,
    );
    expect(await reader.getQuestionState(Q)).toBeNull();
  });

  it("returns null when the LogNewQuestion scan fails", async () => {
    const reader = createPredictionEmbedReaderFromClient(
      mockChainClient({ logsError: true }),
      CONTRACT,
    );
    expect(await reader.getQuestionState(Q)).toBeNull();
  });

  it("returns null when no LogNewQuestion event exists", async () => {
    const reader = createPredictionEmbedReaderFromClient(
      mockChainClient({ logs: [] }),
      CONTRACT,
    );
    expect(await reader.getQuestionState(Q)).toBeNull();
  });

  it("returns question text from the LogNewQuestion event", async () => {
    const reader = createPredictionEmbedReaderFromClient(
      mockChainClient(),
      CONTRACT,
    );
    const state = await reader.getQuestionState(Q);
    expect(state?.questionText).toContain("Will it rain?");
    expect(state?.templateId).toBe(0);
  });
});

describe("windowed LogNewQuestion scan", () => {
  const CREATED_BLOCK = BigInt(55_000);
  const LATEST_BLOCK = BigInt(100_000);

  function windowedClient(overrides?: { logsError?: boolean }) {
    const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
    const client = {
      ranges,
      async readContract() {
        return questionTuple(`0x${"ab".repeat(32)}`);
      },
      async getBlockNumber() {
        return LATEST_BLOCK;
      },
      async getLogs(rawArgs: unknown) {
        const args = rawArgs as { fromBlock: bigint; toBlock: bigint };
        if (overrides?.logsError) throw new Error("range too large");
        ranges.push({ fromBlock: args.fromBlock, toBlock: args.toBlock });
        if (args.fromBlock <= CREATED_BLOCK && CREATED_BLOCK <= args.toBlock) {
          return [
            {
              args: {
                question: `Will it rain?\u241f["No","Yes"]\u241fgeneral\u241fen_US`,
                template_id: BigInt(0),
              },
            },
          ];
        }
        return [];
      },
    };
    return client;
  }

  it("finds the event in an older window using provider-safe ranges", async () => {
    const client = windowedClient();
    const reader = createPredictionEmbedReaderFromClient(client, CONTRACT);
    const state = await reader.getQuestionState(Q);
    expect(state?.questionText).toContain("Will it rain?");
    expect(client.ranges.length).toBeGreaterThan(1);
    for (const range of client.ranges) {
      expect(range.toBlock - range.fromBlock).toBeLessThan(BigInt(10_000));
      expect(range.fromBlock).toBeGreaterThanOrEqual(BigInt(0));
    }
  });

  it("returns null when the event is beyond the scan budget", async () => {
    let calls = 0;
    const client = {
      async readContract() {
        return questionTuple(`0x${"ab".repeat(32)}`);
      },
      async getBlockNumber() {
        return BigInt(3_000_000);
      },
      async getLogs() {
        calls++;
        return [] as Array<{ args?: Record<string, unknown> }>;
      },
    };
    const reader = createPredictionEmbedReaderFromClient(client, CONTRACT);
    expect(await reader.getQuestionState(Q)).toBeNull();
    expect(calls).toBeLessThanOrEqual(200);
    expect(calls).toBeGreaterThan(0);
  });

  it("returns null when a window scan errors", async () => {
    const reader = createPredictionEmbedReaderFromClient(
      windowedClient({ logsError: true }),
      CONTRACT,
    );
    expect(await reader.getQuestionState(Q)).toBeNull();
  });
});
