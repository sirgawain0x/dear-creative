import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  parseUnits,
  type Address,
} from "viem";
import { BASE_USDC_ADDRESS, USDC_DECIMALS } from "@/lib/payments/subscription-config";

export type AdminWalletSendAsset = "USDC" | "ETH";

export type AdminWalletSendValidationInput = {
  recipient: string;
  amount: string;
  asset: AdminWalletSendAsset;
  fromAddress: Address;
  balances: {
    ethRaw: bigint;
    usdcRaw: bigint;
  };
};

export type AdminWalletSendValidationSuccess = {
  ok: true;
  recipient: Address;
  amountRaw: bigint;
  amountFormatted: string;
  asset: AdminWalletSendAsset;
  warnings: string[];
};

export type AdminWalletSendValidationFailure = {
  ok: false;
  error: string;
  field?: "recipient" | "amount" | "asset";
};

export type AdminWalletSendValidationResult =
  | AdminWalletSendValidationSuccess
  | AdminWalletSendValidationFailure;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export function validateAdminWalletSendInput(
  input: AdminWalletSendValidationInput,
): AdminWalletSendValidationResult {
  const trimmedRecipient = input.recipient.trim();
  if (!trimmedRecipient) {
    return { ok: false, error: "Recipient address is required.", field: "recipient" };
  }
  if (!isAddress(trimmedRecipient, { strict: true })) {
    return {
      ok: false,
      error: "Recipient must be a checksummed address.",
      field: "recipient",
    };
  }
  let recipient: Address;
  try {
    recipient = getAddress(trimmedRecipient);
  } catch {
    return {
      ok: false,
      error: "Recipient must be a checksummed address.",
      field: "recipient",
    };
  }
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
  const numeric = Number(amountTrimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { ok: false, error: "Amount must be a positive number.", field: "amount" };
  }

  let amountRaw: bigint;
  let amountFormatted: string;
  try {
    if (input.asset === "USDC") {
      amountRaw = parseUnits(amountTrimmed, USDC_DECIMALS);
      amountFormatted = amountTrimmed;
    } else {
      amountRaw = parseUnits(amountTrimmed, 18);
      amountFormatted = amountTrimmed;
    }
  } catch {
    return { ok: false, error: "Amount has too many decimal places.", field: "amount" };
  }
  if (amountRaw <= BigInt(0)) {
    return { ok: false, error: "Amount must be a positive number.", field: "amount" };
  }

  const balance =
    input.asset === "USDC" ? input.balances.usdcRaw : input.balances.ethRaw;
  if (amountRaw > balance) {
    return { ok: false, error: "Amount exceeds available balance.", field: "amount" };
  }

  return {
    ok: true,
    recipient,
    amountRaw,
    amountFormatted,
    asset: input.asset,
    warnings,
  };
}

export type AdminWalletSendCall = {
  to: Address;
  value: bigint;
  data: `0x${string}`;
};

export function buildAdminWalletSendCalls(
  validated: AdminWalletSendValidationSuccess,
): AdminWalletSendCall[] {
  if (validated.asset === "ETH") {
    return [
      {
        to: validated.recipient,
        value: validated.amountRaw,
        data: "0x",
      },
    ];
  }
  return [
    {
      to: BASE_USDC_ADDRESS,
      value: BigInt(0),
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [validated.recipient, validated.amountRaw],
      }),
    },
  ];
}
