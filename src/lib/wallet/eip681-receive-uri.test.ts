import QRCode from "qrcode";
import jsQR from "jsqr";
import sharp from "sharp";
import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";
import {
  BASE_RECEIVE_CHAIN_ID,
  buildEip681BaseUsdcReceiveUri,
} from "./eip681-receive-uri";

const FIXTURE_RAW = "0xAE48B6dB64772b9CC24e33A79c809896776a20f6";

async function decodeQrPngPayload(pngBuffer: Buffer): Promise<string> {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!decoded?.data) {
    throw new Error("jsQR could not decode QR PNG");
  }
  return decoded.data;
}

describe("buildEip681BaseUsdcReceiveUri", () => {
  it("uses USDC transfer form with checksummed recipient on Base", () => {
    expect(buildEip681BaseUsdcReceiveUri(FIXTURE_RAW)).toBe(
      `ethereum:${getAddress(BASE_USDC_ADDRESS)}@${BASE_RECEIVE_CHAIN_ID}/transfer?address=${getAddress(FIXTURE_RAW)}`,
    );
  });

  it("appends uint256 when amount base units are provided", () => {
    expect(
      buildEip681BaseUsdcReceiveUri(FIXTURE_RAW, { amountBaseUnits: 1_000_000n }),
    ).toBe(
      `ethereum:${getAddress(BASE_USDC_ADDRESS)}@${BASE_RECEIVE_CHAIN_ID}/transfer?address=${getAddress(FIXTURE_RAW)}&uint256=1000000`,
    );
  });

  it("rejects negative amount base units", () => {
    expect(() =>
      buildEip681BaseUsdcReceiveUri(FIXTURE_RAW, { amountBaseUnits: -1n }),
    ).toThrow(/non-negative integer/i);
  });

  it("generates a QR whose payload matches the exact EIP-681 string", async () => {
    const uri = buildEip681BaseUsdcReceiveUri(FIXTURE_RAW);
    const png = await QRCode.toBuffer(uri, { margin: 1, width: 200 });
    const payload = await decodeQrPngPayload(png);
    expect(payload).toBe(uri);
    expect(payload).toBe(
      "ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    );
  });
});
