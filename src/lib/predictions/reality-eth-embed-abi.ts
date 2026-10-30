/**
 * Reality.eth 3.0 read ABI — excerpt from sirgawain0x/crtv3
 * `lib/sdk/reality-eth/reality-eth-abi.json` (LogNewQuestion + view functions used by embed).
 */
import { parseAbi } from "viem";

export const REALITY_ETH_EMBED_ABI = parseAbi([
  "function questions(bytes32 question_id) view returns (bytes32 content_hash, address arbitrator, uint32 opening_ts, uint32 timeout, uint32 finalize_ts, bool is_pending_arbitration, uint256 bounty, bytes32 best_answer, bytes32 history_hash, uint256 bond, uint256 min_bond)",
  "function isFinalized(bytes32 question_id) view returns (bool)",
  "function resultFor(bytes32 question_id) view returns (bytes32)",
  "event LogNewQuestion(bytes32 indexed question_id, address indexed user, uint256 template_id, string question, bytes32 indexed content_hash, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce, uint256 created)",
]);

/** Oracle resolver still uses minimal ABI; embed reads use REALITY_ETH_EMBED_ABI. */
export const REALITY_ETH_ORACLE_ABI = parseAbi([
  "function isFinalized(bytes32 question_id) view returns (bool)",
  "function resultFor(bytes32 question_id) view returns (bytes32)",
]);
