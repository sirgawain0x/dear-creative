import QRCode from "qrcode";
import jsQR from "jsqr";
import sharp from "sharp";
import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import {
  BASE_RECEIVE_CHAIN_ID,
  buildEip681BaseReceiveUri,
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

describe("buildEip681BaseReceiveUri", () => {
  it("uses viem checksummed address and Base chain id", () => {
    expect(buildEip681BaseReceiveUri(FIXTURE_RAW)).toBe(
      `ethereum:${getAddress(FIXTURE_RAW)}@${BASE_RECEIVE_CHAIN_ID}`,
    );
  });

  it("generates a QR whose payload matches the exact EIP-681 string", async () => {
    const uri = buildEip681BaseReceiveUri(FIXTURE_RAW);
    const png = await QRCode.toBuffer(uri, { margin: 1, width: 200 });
    const payload = await decodeQrPngPayload(png);
    expect(payload).toBe(uri);
    expect(payload).toBe(
      "ethereum:0xAE48B6dB64772b9CC24e33A79c809896776a20f6@8453",
    );
  });
});
