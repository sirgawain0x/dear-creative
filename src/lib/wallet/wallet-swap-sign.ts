import { getAddress, type Address, type Hex } from "viem";
import { ALCHEMY_MAV2_V110 } from "./swap-constants";
import {
  WALLET_SWAP_SIGNATURE_TYPE_ERROR,
  WALLET_SWAP_UPGRADE_TARGET_ERROR,
} from "./swap-errors";
import {
  assertEmbeddedSignerIsAdmin,
  BASE_CHAIN_ID,
  ensureBaseChain,
  type EmbeddedEthereumProvider,
} from "./wallet-send-embedded";

type SignatureRequest = {
  type?: string;
  data?: { raw?: Hex };
  rawPayload?: Hex;
};

export type SignSwapPreparedCallResult = {
  signature: Hex;
  authorizations: unknown[];
};

function readSignatureRequest(prepared: Record<string, unknown>): SignatureRequest | null {
  const sr = prepared.signatureRequest;
  if (!sr || typeof sr !== "object") {
    return null;
  }
  return sr as SignatureRequest;
}

async function personalSignRaw(
  provider: EmbeddedEthereumProvider,
  account: Address,
  raw: Hex,
): Promise<Hex> {
  const sig = (await provider.request({
    method: "personal_sign",
    params: [raw, account],
  })) as Hex;
  return sig;
}

function assertPersonalSignRequest(sigReq: SignatureRequest): void {
  if (sigReq.type !== undefined && sigReq.type !== "personal_sign") {
    throw new Error(WALLET_SWAP_SIGNATURE_TYPE_ERROR);
  }
}

function assertDelegationTarget(contractAddress: Address): void {
  if (contractAddress.toLowerCase() !== ALCHEMY_MAV2_V110.toLowerCase()) {
    throw new Error(WALLET_SWAP_UPGRADE_TARGET_ERROR);
  }
}

export async function signSwapPreparedCall(input: {
  provider: EmbeddedEthereumProvider;
  adminAddress: Address;
  prepared: Record<string, unknown> | unknown[];
  signAuthorization?: (args: {
    contractAddress: Address;
    chainId: number;
  }) => Promise<Hex | Record<string, unknown>>;
}): Promise<SignSwapPreparedCallResult> {
  await ensureBaseChain(input.provider);
  await assertEmbeddedSignerIsAdmin(input.provider, input.adminAddress);

  const authorizations: unknown[] = [];

  if (Array.isArray(input.prepared)) {
    for (const item of input.prepared) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      if (record.type === "authorization" || record.type === "eip7702-authorization") {
        const delegation =
          typeof record.contractAddress === "string"
            ? getAddress(record.contractAddress)
            : ALCHEMY_MAV2_V110;
        assertDelegationTarget(delegation);
        if (!input.signAuthorization) {
          throw new Error("Wallet upgrade authorization is required.");
        }
        const auth = await input.signAuthorization({
          contractAddress: delegation,
          chainId: BASE_CHAIN_ID,
        });
        authorizations.push(auth);
        continue;
      }
      const sigReq = readSignatureRequest(record);
      if (sigReq?.data?.raw) {
        assertPersonalSignRequest(sigReq);
        const signature = await personalSignRaw(
          input.provider,
          input.adminAddress,
          sigReq.data.raw,
        );
        return { signature, authorizations };
      }
    }
  }

  const preparedRecord = input.prepared as Record<string, unknown>;
  const sigReq = readSignatureRequest(preparedRecord);
  if (!sigReq?.data?.raw) {
    throw new Error("Missing swap signature request.");
  }
  assertPersonalSignRequest(sigReq);

  const signature = await personalSignRaw(
    input.provider,
    input.adminAddress,
    sigReq.data.raw,
  );
  return { signature, authorizations };
}
