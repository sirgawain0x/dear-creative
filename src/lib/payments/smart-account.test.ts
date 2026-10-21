import { DefaultAddress, predictModularAccountV2Address } from "@alchemy/smart-accounts";
import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { predictSmartAccountForSigner } from "./smart-account";

/** CTO reference vectors (Alchemy modular account v2, Base factory defaults). */
const CTO_OWNER = "0x0000000000000000000000000000000000000001" as const;

const CTO_VECTORS = [
  {
    salt: BigInt(0),
    expected: "0x352B2DbC6681e75D985764679c7105dF73dFcD23",
  },
  {
    salt: BigInt(1),
    expected: "0xEb9e4abCbA15A17a9e6E736cc30b99f4dd21E94e",
  },
] as const;

describe("predictSmartAccountForSigner (CTO vectors)", () => {
  it("matches salt 0 for the reference owner (production salt)", () => {
    const predicted = predictSmartAccountForSigner(CTO_OWNER);
    expect(getAddress(predicted)).toBe(getAddress(CTO_VECTORS[0]!.expected));
  });

  it("matches CTO vectors for salt 0 and salt 1 via Alchemy predictor", () => {
    const owner = getAddress(CTO_OWNER);
    for (const vector of CTO_VECTORS) {
      const predicted = predictModularAccountV2Address({
        factoryAddress: DefaultAddress.MAV2_FACTORY,
        implementationAddress: DefaultAddress.SMAV2_BYTECODE,
        type: "SMA",
        ownerAddress: owner,
        salt: vector.salt,
      });
      expect(getAddress(predicted)).toBe(getAddress(vector.expected));
    }
  });
});
