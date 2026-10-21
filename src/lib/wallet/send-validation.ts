import {
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Address,
} from "viem";
import { BASE_USDC_ADDRESS, USDC_DECIMALS } from "@/lib/payments/subscription-config";
import { parseChecksumAddress } from "./parse-checksum-address";
import { getWalletSendMaxUsdc } from "./send-max-usdc";

export const USDC_AMOUNT_REGEX = /^\d+(\.\d{1,6})?$/;

export type AdminWalletSendValidationInput = {
  recipient: string;
  amount: string;
  fromAddress: Address;
  balances: {
    usdcRaw: bigint;
  };
};

export type AdminWalletSendValidationSuccess = {
  ok: true;
  recipient: Address;
  amountRaw: bigint;
  amountFormatted: string;
  warnings: string[];
};

export type AdminWalletSendValidationFailure = {
  ok: false;
  error: string;
  field?: "recipient" | "amount";
};

export type AdminWalletSendValidationResult =
  | AdminWalletSendValidationSuccess
  | AdminWalletSendValidationFailure;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export function validateAdminWalletSendInput(
  input: AdminWalletSendValidationInput,
): AdminWalletSendValidationResult {
  const parsedRecipient = parseChecksumAddress(input.recipient);
  if (!parsedRecipient.ok) {
    return {
      ok: false,
      error: parsedRecipient.error,
      field: "recipient",
    };
  }
  const recipient = parsedRecipient.address;
  if (recipient.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return { ok: false, error: "Zero address is not allowed.", field: "recipient" };
  }

  const warnings: string[] = [];
  if (recipient.toLowerCase() === input.fromAddress.toLowerCase()) {
    warnings.push("Recipient is the same as this wallet address.");
  }

  const amountTrimmed = input.amount.trim();
  if (!amountTrimmed) {
    return { ok: false, error: "Amount is required.", field: "amount" };
  }
  if (!USDC_AMOUNT_REGEX.test(amountTrimmed)) {
    return {
      ok: false,
      error: "Amount must be a positive USDC value with up to 6 decimal places.",
      field: "amount",
    };
  }
  if (/^0+(\.0+)?$/.test(amountTrimmed)) {
    return { ok: false, error: "Amount must be greater than zero.", field: "amount" };
  }

  let amountRaw: bigint;
  try {
    amountRaw = parseUnits(amountTrimmed, USDC_DECIMALS);
  } catch {
    return { ok: false, error: "Amount has too many decimal places.", field: "amount" };
  }
  if (amountRaw <= BigInt(0)) {
    return { ok: false, error: "Amount must be greater than zero.", field: "amount" };
  }

  const maxUsdc = getWalletSendMaxUsdc();
  const maxRaw = parseUnits(String(maxUsdc), USDC_DECIMALS);
  if (amountRaw > maxRaw) {
    return {
      ok: false,
      error: `Amount exceeds the ${maxUsdc} USDC send limit.`,
      field: "amount",
    };
  }

  if (amountRaw > input.balances.usdcRaw) {
    return { ok: false, error: "Amount exceeds available balance.", field: "amount" };
  }

  return {
    ok: true,
    recipient,
    amountRaw,
    amountFormatted: amountTrimmed,
    warnings,
  };
}

export type AdminWalletSendCall = {
  to: Address;
  value: bigint;
  data: `0x${string}`;
};

export function buildAdminWalletSendCall(
  validated: AdminWalletSendValidationSuccess,
): AdminWalletSendCall {
  return {
    to: BASE_USDC_ADDRESS,
    value: BigInt(0),
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [validated.recipient, validated.amountRaw],
    }),
  };
}
