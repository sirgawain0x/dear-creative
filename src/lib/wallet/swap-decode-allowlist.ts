import { decodeFunctionData, getAddress, type Address, type Hex } from "viem";
import { MAV2_EXECUTE_ABI, type Mav2ExecuteCall } from "./swap-mav2-abi";

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export type DecodedExecuteTarget = {
  target: Address;
  selector: Hex;
};

function readSelector(data: Hex): Hex | null {
  if (!data || data === "0x" || data.length < 10) {
    return null;
  }
  return data.slice(0, 10).toLowerCase() as Hex;
}

function decodeMav2Executions(callData: Hex): Mav2ExecuteCall[] | null {
  try {
    const decoded = decodeFunctionData({ abi: MAV2_EXECUTE_ABI, data: callData });
    if (decoded.functionName === "execute") {
      const [target, value, data] = decoded.args as [Address, bigint, Hex];
      return [{ target, value, data }];
    }
    if (decoded.functionName === "executeBatch") {
      return decoded.args[0] as Mav2ExecuteCall[];
    }
  } catch {
    return null;
  }
  return null;
}

function collectCallDataSegments(node: unknown): Hex[] {
  const segments: Hex[] = [];

  const visit = (value: unknown): void => {
    if (value === null || value === undefined) {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (typeof value !== "object") {
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of ["data", "callData"] as const) {
      const raw = record[key];
      if (typeof raw === "string" && raw.startsWith("0x") && raw.length >= 10) {
        segments.push(raw as Hex);
      }
    }
    for (const child of Object.values(record)) {
      if (child !== record.data && child !== record.callData) {
        visit(child);
      }
    }
  };

  visit(node);
  return segments;
}

/** Decode MAv2 execute targets and inner selectors from a prepared swap payload. */
export function decodePreparedSwapExecuteTargets(
  prepared: unknown,
): DecodedExecuteTarget[] {
  const segments = collectCallDataSegments(prepared);
  const out: DecodedExecuteTarget[] = [];

  for (const segment of segments) {
    const executions = decodeMav2Executions(segment);
    if (!executions) {
      continue;
    }
    for (const exec of executions) {
      const selector = readSelector(exec.data);
      if (!selector) {
        continue;
      }
      out.push({ target: getAddress(exec.target), selector });
    }
  }

  return out;
}

export function decodeApproveSpenderAndAmount(
  data: Hex,
): { spender: Address; amount: bigint } | null {
  try {
    const decoded = decodeFunctionData({ abi: ERC20_APPROVE_ABI, data });
    if (decoded.functionName !== "approve") {
      return null;
    }
    const [spender, amount] = decoded.args as [Address, bigint];
    return { spender: getAddress(spender), amount };
  } catch {
    return null;
  }
}
