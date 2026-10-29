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
  openingTs: number;
  bondWei: bigint;
  bestAnswer: Hex;
  nowSec: number;
}): PredictionEmbedStatus {
  if (input.isFinalized) return "finalized";
  const hasActivity =
    input.bondWei > BigInt(0) ||
    (input.bestAnswer.toLowerCase() !== ZERO_ANSWER &&
      input.bestAnswer !== "0x");
  if (hasActivity || input.nowSec >= input.openingTs) return "bonding";
  return "open";
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
  );
}

type EmbedChainClient = {
  readContract: (args: unknown) => Promise<unknown>;
  getLogs: (
    args: unknown,
  ) => Promise<Array<{ args?: Record<string, unknown> }>>;
};

export function createPredictionEmbedReaderFromClient(
  client: EmbedChainClient,
  contractAddress: Address,
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

        let questionText = "";
        let templateId: number | null = null;

        try {
          const logs = await client.getLogs({
            address: contractAddress,
            event: LOG_NEW_QUESTION_EVENT,
            args: { question_id: questionId },
            fromBlock: BigInt(0),
          });
          if (logs[0]?.args) {
            questionText = (logs[0].args as { question?: string }).question ?? "";
            const tid = (logs[0].args as { template_id?: bigint }).template_id;
            templateId = tid != null ? Number(tid) : null;
          }
        } catch {
          // RPC log scan may fail; struct fields still useful
        }

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

    const parsed = parsePredictionDisplay(
      state.questionText || "Untitled Prediction",
      state.templateId,
    );

    const finalized = await reader.isFinalized(questionId);
    const nowSec = Math.floor(Date.now() / 1000);
    const status = deriveStatus({
      isFinalized: finalized,
      openingTs: state.openingTs,
      bondWei: state.bondWei,
      bestAnswer: state.bestAnswer,
      nowSec,
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
