import { parseAbi } from "viem";

/** Modular Account V2 account execution surface (execute / executeBatch). */
export const MAV2_EXECUTE_ABI = parseAbi([
  "function execute(address target, uint256 value, bytes data)",
  "function executeBatch((address target, uint256 value, bytes data)[] calls)",
]);

export type Mav2ExecuteCall = {
  target: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
};
