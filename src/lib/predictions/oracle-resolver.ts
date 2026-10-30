import type { DearCreativeDb } from "@/db/client";
import { predictions } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  type Address,
  createPublicClient,
  http,
  type Hex,
} from "viem";
import {
  buildSocialPost,
  parseRealityQuestion,
  resolveRealityAnswer,
} from "@/lib/reality-format";
import {
  broadcastOracleResolution,
  type BroadcastOracleResolutionResult,
  oracleSocialChannelsPublished,
} from "@/lib/social";
import { isOracleEnabled } from "@/lib/predictions/feature-flag";
import {
  resolveOracleChain,
  resolveOracleRpcUrl,
} from "@/lib/predictions/oracle-chain";
import {
  REALITY_ETH_BASE_MAINNET,
  resolveRealityEthContractAddress,
} from "@/lib/predictions/reality-eth-address";
import { REALITY_ETH_ORACLE_ABI } from "@/lib/predictions/reality-eth-embed-abi";

export { REALITY_ETH_BASE_MAINNET };

export const REALITY_ETH_ABI = REALITY_ETH_ORACLE_ABI;

export interface OracleContractReader {
  isFinalized(questionId: Hex): Promise<boolean>;
  resultFor(questionId: Hex): Promise<Hex>;
}

export function createDefaultOracleReader(): OracleContractReader {
  const chain = resolveOracleChain();
  const contractAddress = resolveRealityEthContractAddress() as Address;

  const rpcUrl = resolveOracleRpcUrl();

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 10_000 }),
  });

  return {
    async isFinalized(questionId: Hex) {
      return client.readContract({
        address: contractAddress,
        abi: REALITY_ETH_ABI,
        functionName: "isFinalized",
        args: [questionId],
      });
    },
    async resultFor(questionId: Hex) {
      return client.readContract({
        address: contractAddress,
        abi: REALITY_ETH_ABI,
        functionName: "resultFor",
        args: [questionId],
      });
    },
  };
}

export type ProcessedPredictionResult = {
  id: string;
  questionId: string;
  articleSlug: string;
  status: "finalized" | "still_pending" | "error";
  outcome?: string;
  social?: BroadcastOracleResolutionResult;
  error?: string;
};

export async function resolvePendingPredictions(
  db: DearCreativeDb,
  options?: {
    reader?: OracleContractReader;
    broadcaster?: typeof broadcastOracleResolution;
  },
): Promise<{
  totalPending: number;
  finalizedCount: number;
  results: ProcessedPredictionResult[];
  disabled?: boolean;
}> {
  if (!isOracleEnabled()) {
    return {
      totalPending: 0,
      finalizedCount: 0,
      results: [],
      disabled: true,
    };
  }

  const reader = options?.reader ?? createDefaultOracleReader();
  const broadcaster = options?.broadcaster ?? broadcastOracleResolution;

  const pendingList = await db
    .select()
    .from(predictions)
    .where(eq(predictions.status, "pending"));

  const results: ProcessedPredictionResult[] = [];
  let finalizedCount = 0;

  for (const item of pendingList) {
    try {
      const qId = item.questionId.startsWith("0x")
        ? (item.questionId as Hex)
        : (`0x${item.questionId}` as Hex);

      const isDone = await reader.isFinalized(qId);
      if (!isDone) {
        results.push({
          id: item.id,
          questionId: item.questionId,
          articleSlug: item.articleSlug,
          status: "still_pending",
        });
        continue;
      }

      const rawResult = await reader.resultFor(qId);
      const parsedQ = parseRealityQuestion(item.questionText);
      const outcomeText = resolveRealityAnswer(rawResult, parsedQ.outcomes);

      const dispatchTitle = item.articleSlug
        .replace(/-/g, " ")
        .toUpperCase();

      const postMessage = buildSocialPost({
        articleSlug: item.articleSlug,
        dispatchTitle,
        rawQuestion: item.questionText,
        rawResult,
        txHash: item.txHash,
        minBondWei: item.minBondWei ?? undefined,
      });

      const socialResult = await broadcaster(postMessage, item.txHash);
      const now = Date.now();
      const socialPublished = oracleSocialChannelsPublished(socialResult);

      await db
        .update(predictions)
        .set({
          status: "finalized",
          rawResult,
          resolvedOutcome: outcomeText,
          resolvedAt: new Date(now),
          socialBroadcastAt: socialPublished ? new Date(now) : null,
          updatedAt: new Date(now),
        })
        .where(eq(predictions.id, item.id));

      finalizedCount++;
      results.push({
        id: item.id,
        questionId: item.questionId,
        articleSlug: item.articleSlug,
        status: "finalized",
        outcome: outcomeText,
        social: socialResult,
      });
    } catch (err) {
      results.push({
        id: item.id,
        questionId: item.questionId,
        articleSlug: item.articleSlug,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    totalPending: pendingList.length,
    finalizedCount,
    results,
  };
}
