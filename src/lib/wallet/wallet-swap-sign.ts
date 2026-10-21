import { getAddress, type Address, type Hex } from "viem";
import {
  assertEmbeddedSignerIsAdmin,
  BASE_CHAIN_ID,
  ensureBaseChain,
  type EmbeddedEthereumProvider,
} from "./wallet-send-embedded";
import { ALCHEMY_MAV2_V110 } from "./swap-constants";

type SignatureRequest = {
  type?: string;
  data?: { raw?: Hex };
  rawPayload?: Hex;
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

export async function signSwapPreparedCall(input: {
  provider: EmbeddedEthereumProvider;
  adminAddress: Address;
  prepared: Record<string, unknown>;
  signAuthorization?: (args: {
    contractAddress: Address;
    chainId: number;
  }) => Promise<Hex | Record<string, unknown>>;
}): Promise<{ signature: Hex; authorizations?: unknown[] }> {
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
        const signature = await personalSignRaw(
          input.provider,
          input.adminAddress,
          sigReq.data.raw,
        );
        return { signature, authorizations };
      }
    }
  }

  const sigReq = readSignatureRequest(input.prepared);
  if (!sigReq?.data?.raw) {
    throw new Error("Missing swap signature request.");
  }

  const signature = await personalSignRaw(
    input.provider,
    input.adminAddress,
    sigReq.data.raw,
  );
  return { signature, authorizations };
}
