import { unstable_cache } from "next/cache";
import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import {
  answerBytesToLabel,
  parsePredictionDisplay,
} from "@/lib/predictions/parse-prediction-display";
import {
  resolveOracleChain,
  resolveOracleNetworkId,
  resolveOracleRpcUrl,
} from "@/lib/predictions/oracle-chain";
import { resolveRealityEthContractAddress } from "@/lib/predictions/reality-eth-address";
import { REALITY_ETH_EMBED_ABI } from "@/lib/predictions/reality-eth-embed-abi";

const LOG_NEW_QUESTION_EVENT = parseAbiItem(
  "event LogNewQuestion(bytes32 indexed question_id, address indexed user, uint256 template_id, string question, bytes32 indexed content_hash, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce, uint256 created)",
);

const ZERO_ANSWER =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export type PredictionEmbedStatus = "open" | "bonding" | "finalized";

export type PredictionEmbedData = {
  ok: true;
  questionId: Hex;
  viewUrl: string;
  title: string;
  outcomes: string[];
  category: string;
  status: PredictionEmbedStatus;
  resultLabel: string | null;
  minBondWei: string | null;
  bondWei: string | null;
  openingTs: number | null;
  timeoutSec: number | null;
  finalizeTs: number | null;
};

export type PredictionEmbedResult =
  | PredictionEmbedData
  | { ok: false; questionId: Hex; viewUrl: string; error: string };

export type PredictionEmbedReader = {
  getQuestionState(questionId: Hex): Promise<{
    questionText: string;
    templateId: number | null;
    openingTs: number;
    timeoutSec: number;
    finalizeTs: number;
    minBondWei: bigint;
    bondWei: bigint;
    bestAnswer: Hex;
  } | null>;
  isFinalized(questionId: Hex): Promise<boolean>;
  resultFor(questionId: Hex): Promise<Hex>;
};

function normalizeQuestionId(raw: string): Hex | null {
  const trimmed = raw.trim();
  const id = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(id)) return null;
  return id.toLowerCase() as Hex;
}

function deriveStatus(input: {
  isFinalized: boolean;
  bondWei: bigint;
  bestAnswer: Hex;
}): PredictionEmbedStatus {
  if (input.isFinalized) return "finalized";
  // "Bonding" means answers are actively being bonded. A market whose
  // opening time has passed but which has no answers yet is still open —
  // elapsed time alone is not bonding activity.
  const hasActivity =
    input.bondWei > BigInt(0) ||
    (input.bestAnswer.toLowerCase() !== ZERO_ANSWER &&
      input.bestAnswer !== "0x");
  return hasActivity ? "bonding" : "open";
}

export function createDefaultPredictionEmbedReader(): PredictionEmbedReader {
  const chain = resolveOracleChain();
  const address = resolveRealityEthContractAddress() as Address;
  const client = createPublicClient({
    chain,
    transport: http(resolveOracleRpcUrl(), { timeout: 10_000 }),
  });

  return createPredictionEmbedReaderFromClient(
    client as unknown as EmbedChainClient,
    address,
    {
      logScanFloorBlock:
        resolveOracleNetworkId() === "base"
          ? REALITY_ETH_BASE_DEPLOYMENT_BLOCK
          : BigInt(0),
    },
  );
}

type EmbedChainClient = {
  readContract: (args: unknown) => Promise<unknown>;
  getLogs: (
    args: unknown,
  ) => Promise<Array<{ args?: Record<string, unknown> }>>;
  getBlockNumber?: () => Promise<bigint>;
};

type EmbedLog = { args?: Record<string, unknown> };

// RealityETH-3.0 on Base was deployed at this block (per Creative TV's
// subgraph config for the same contract), so LogNewQuestion events for this
// contract cannot exist below it.
export const REALITY_ETH_BASE_DEPLOYMENT_BLOCK = BigInt(26_260_675);
// Providers (Alchemy, public Base RPC) reject eth_getLogs ranges much above
// ~10k blocks, so an unbounded from-genesis scan always fails. Scan backwards
// from the latest block in provider-safe windows instead.
export const LOG_SCAN_WINDOW_BLOCKS = BigInt(10_000);
// Total span covered: 200 windows * 10k blocks = 2M blocks (~46 days on
// Base). Posts embed recently created markets; anything older degrades to
// the plain fallback link. A subgraph/indexer is the long-term source for
// question text (Creative TV itself uses one) — tracked as follow-up.
export const LOG_SCAN_MAX_WINDOWS = 200;
const LOG_SCAN_BATCH = 8;

/**
 * Find the LogNewQuestion event for `questionId` without an unbounded
 * genesis scan. Windows are scanned newest-first in parallel batches; the
 * creation event is unique, so the first hit is the answer. Returns null
 * when no event exists at or above `floorBlock` within the scan budget.
 * Throws on RPC failure so the caller fails closed.
 */
async function findNewQuestionLog(
  client: EmbedChainClient,
  contractAddress: Address,
  questionId: Hex,
  floorBlock: bigint,
): Promise<EmbedLog | null> {
  if (typeof client.getBlockNumber !== "function") {
    // Minimal injected clients (tests) keep the single-call behavior.
    const logs = await client.getLogs({
      address: contractAddress,
      event: LOG_NEW_QUESTION_EVENT,
      args: { question_id: questionId },
      fromBlock: floorBlock,
    });
    return logs[0] ?? null;
  }

  const latest = await client.getBlockNumber();
  let cursor = latest;
  let windows = 0;
  while (cursor >= floorBlock && windows < LOG_SCAN_MAX_WINDOWS) {
    const batch: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
    while (
      batch.length < LOG_SCAN_BATCH &&
      cursor >= floorBlock &&
      windows + batch.length < LOG_SCAN_MAX_WINDOWS
    ) {
      const fromBlock =
        cursor - LOG_SCAN_WINDOW_BLOCKS + BigInt(1) < floorBlock
          ? floorBlock
          : cursor - LOG_SCAN_WINDOW_BLOCKS + BigInt(1);
      batch.push({ fromBlock, toBlock: cursor });
      cursor = fromBlock - BigInt(1);
    }
    if (batch.length === 0) break;
    windows += batch.length;
    const results = await Promise.all(
      batch.map((range) =>
        client.getLogs({
          address: contractAddress,
          event: LOG_NEW_QUESTION_EVENT,
          args: { question_id: questionId },
          fromBlock: range.fromBlock,
          toBlock: range.toBlock,
        }),
      ),
    );
    // Batch windows are newest-first; the creation event is unique.
    for (const logs of results) {
      if (logs[0]) return logs[0];
    }
  }
  return null;
}

export function createPredictionEmbedReaderFromClient(
  client: EmbedChainClient,
  contractAddress: Address,
  opts?: { logScanFloorBlock?: bigint },
): PredictionEmbedReader {
  return {
    async getQuestionState(questionId) {
      try {
        const row = await client.readContract({
          address: contractAddress,
          abi: REALITY_ETH_EMBED_ABI,
          functionName: "questions",
          args: [questionId],
        });

        const tuple = row as readonly [
          Hex,
          Address,
          number,
          number,
          number,
          boolean,
          bigint,
          Hex,
          Hex,
          bigint,
          bigint,
        ];

        // Reality.eth returns a zero struct for unknown question ids instead
        // of reverting. A zero content hash means the question does not
        // exist — report it as not found rather than rendering a fake card.
        const contentHash = tuple[0];
        if (
          !contentHash ||
          contentHash.toLowerCase() ===
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        ) {
          return null;
        }

        // The question text, outcomes, and template id exist only on the
        // LogNewQuestion event; the struct does not store them. If the log
        // scan fails or finds no event, the embed cannot be rendered
        // truthfully — return null so the caller falls back to the plain
        // "View on Creative TV" link instead of an untitled card with
        // default outcomes.
        const log = await findNewQuestionLog(
          client,
          contractAddress,
          questionId,
          opts?.logScanFloorBlock ?? BigInt(0),
        );
        const questionText =
          (log?.args as { question?: string } | undefined)?.question ?? "";
        if (!questionText) {
          return null;
        }
        const tid = (log?.args as { template_id?: bigint }).template_id;
        const templateId = tid != null ? Number(tid) : null;

        return {
          questionText,
          templateId,
          openingTs: Number(tuple[2]),
          timeoutSec: Number(tuple[3]),
          finalizeTs: Number(tuple[4]),
          minBondWei: tuple[10] as bigint,
          bondWei: tuple[9] as bigint,
          bestAnswer: tuple[7] as Hex,
        };
      } catch {
        return null;
      }
    },
    async isFinalized(questionId) {
      const result = await client.readContract({
        address: contractAddress,
        abi: REALITY_ETH_EMBED_ABI,
        functionName: "isFinalized",
        args: [questionId],
      });
      return Boolean(result);
    },
    async resultFor(questionId) {
      const result = await client.readContract({
        address: contractAddress,
        abi: REALITY_ETH_EMBED_ABI,
        functionName: "resultFor",
        args: [questionId],
      });
      return result as Hex;
    },
  };
}

export async function fetchPredictionEmbed(
  questionIdRaw: string,
  viewUrl: string,
  reader: PredictionEmbedReader = createDefaultPredictionEmbedReader(),
): Promise<PredictionEmbedResult> {
  const questionId = normalizeQuestionId(questionIdRaw);
  if (!questionId) {
    return {
      ok: false,
      questionId: "0x" as Hex,
      viewUrl,
      error: "Invalid question id",
    };
  }

  try {
    const state = await reader.getQuestionState(questionId);
    if (!state) {
      return { ok: false, questionId, viewUrl, error: "Question not found on chain" };
    }

    // Never fabricate a title/outcomes: without the on-chain question text
    // there is nothing truthful to render, so fail and let the caller fall
    // back to the plain link.
    if (!state.questionText) {
      return {
        ok: false,
        questionId,
        viewUrl,
        error: "Question metadata unavailable",
      };
    }

    const parsed = parsePredictionDisplay(state.questionText, state.templateId);

    const finalized = await reader.isFinalized(questionId);
    const status = deriveStatus({
      isFinalized: finalized,
      bondWei: state.bondWei,
      bestAnswer: state.bestAnswer,
    });

    let resultLabel: string | null = null;
    if (finalized) {
      const rawResult = await reader.resultFor(questionId);
      resultLabel = answerBytesToLabel(rawResult, parsed);
    }

    return {
      ok: true,
      questionId,
      viewUrl,
      title: parsed.title,
      outcomes: parsed.outcomes,
      category: parsed.category,
      status,
      resultLabel,
      minBondWei:
        state.minBondWei > BigInt(0) ? state.minBondWei.toString() : null,
      bondWei: state.bondWei > BigInt(0) ? state.bondWei.toString() : null,
      openingTs: state.openingTs || null,
      timeoutSec: state.timeoutSec || null,
      finalizeTs: state.finalizeTs || null,
    };
  } catch (err) {
    return {
      ok: false,
      questionId,
      viewUrl,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const cachedFetch = unstable_cache(
  async (questionId: string, viewUrl: string) =>
    fetchPredictionEmbed(questionId, viewUrl),
  ["prediction-embed"],
  { revalidate: 60 },
);

export async function fetchPredictionEmbedCached(
  questionId: string,
  viewUrl: string,
): Promise<PredictionEmbedResult> {
  return cachedFetch(questionId, viewUrl);
}
