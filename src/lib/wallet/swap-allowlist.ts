import {
  decodeFunctionData,
  getAddress,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { MAV2_EXECUTE_ABI, type Mav2ExecuteCall } from "./swap-mav2-abi";
import {
  ALCHEMY_MAV2_V110,
  SWAP_ALLOWED_INNER_SELECTORS,
  SWAP_ALLOWED_EXECUTE_TARGETS,
} from "./swap-constants";

const AUTHORIZATION_TYPES = new Set(["authorization", "eip7702-authorization"]);

function normalizeAddress(value: string): Address | null {
  if (!isAddress(value)) {
    return null;
  }
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function isAllowedExecuteTarget(target: Address, adminAddress: Address): boolean {
  const lower = target.toLowerCase();
  if (lower === adminAddress.toLowerCase()) {
    return true;
  }
  return SWAP_ALLOWED_EXECUTE_TARGETS.has(lower);
}

function readSelector(data: Hex): Hex | null {
  if (!data || data === "0x" || data.length < 10) {
    return null;
  }
  return data.slice(0, 10).toLowerCase() as Hex;
}

function assertInnerCalldataAllowed(data: Hex, target: Address): boolean {
  const selector = readSelector(data);
  if (!selector) {
    return true;
  }
  return SWAP_ALLOWED_INNER_SELECTORS.has(selector);
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

function validateAuthorizationItem(
  item: Record<string, unknown>,
): { ok: true } | { ok: false } {
  const type = item.type;
  if (typeof type !== "string" || !AUTHORIZATION_TYPES.has(type)) {
    return { ok: false };
  }
  const contract =
    typeof item.contractAddress === "string"
      ? normalizeAddress(item.contractAddress)
      : ALCHEMY_MAV2_V110;
  if (!contract || contract.toLowerCase() !== ALCHEMY_MAV2_V110.toLowerCase()) {
    return { ok: false };
  }
  return { ok: true };
}

function validateRawCalls(
  calls: unknown[],
  adminAddress: Address,
): { ok: true } | { ok: false } {
  for (const call of calls) {
    if (!call || typeof call !== "object") {
      return { ok: false };
    }
    const record = call as Record<string, unknown>;
    const toRaw = record.to;
    if (typeof toRaw !== "string") {
      return { ok: false };
    }
    const to = normalizeAddress(toRaw);
    if (!to || !isAllowedExecuteTarget(to, adminAddress)) {
      return { ok: false };
    }
    const data =
      typeof record.data === "string" && record.data.startsWith("0x")
        ? (record.data as Hex)
        : ("0x" as Hex);
    if (!assertInnerCalldataAllowed(data, to)) {
      return { ok: false };
    }
  }
  return { ok: true };
}

function validateExecuteSegments(
  segments: Hex[],
  adminAddress: Address,
): { ok: true } | { ok: false } {
  if (segments.length === 0) {
    return { ok: false };
  }

  for (const segment of segments) {
    const executions = decodeMav2Executions(segment);
    if (!executions) {
      return { ok: false };
    }
    for (const exec of executions) {
      const target = getAddress(exec.target);
      if (!isAllowedExecuteTarget(target, adminAddress)) {
        return { ok: false };
      }
      if (!assertInnerCalldataAllowed(exec.data, target)) {
        return { ok: false };
      }
    }
  }
  return { ok: true };
}

/** Validate prepared swap payloads by decoding MAv2 execute / executeBatch calldata. */
export function assertPreparedSwapAllowlisted(
  prepared: unknown,
  adminAddress: Address,
): { ok: true } | { ok: false } {
  if (prepared === null || prepared === undefined) {
    return { ok: false };
  }

  if (Array.isArray(prepared)) {
    for (const item of prepared) {
      if (!item || typeof item !== "object") {
        return { ok: false };
      }
      const record = item as Record<string, unknown>;
      if (typeof record.type === "string" && AUTHORIZATION_TYPES.has(record.type)) {
        const auth = validateAuthorizationItem(record);
        if (!auth.ok) {
          return auth;
        }
      }
    }
    const segments = collectCallDataSegments(prepared);
    return validateExecuteSegments(segments, adminAddress);
  }

  if (typeof prepared !== "object") {
    return { ok: false };
  }

  const record = prepared as Record<string, unknown>;
  if (Array.isArray(record.calls)) {
    const raw = validateRawCalls(record.calls, adminAddress);
    if (!raw.ok) {
      return raw;
    }
  }

  const segments = collectCallDataSegments(prepared);
  return validateExecuteSegments(segments, adminAddress);
}

