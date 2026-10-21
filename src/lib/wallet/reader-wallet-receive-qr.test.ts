import QRCode from "qrcode";
import jsQR from "jsqr";
import sharp from "sharp";
import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { buildEip681BaseUsdcReceiveUri } from "@/lib/wallet/eip681-receive-uri";

const FIXTURE_RECIPIENT = "0xAE48B6dB64772b9CC24e33A79c809896776a20f6";

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

describe("reader wallet receive URI QR round-trip", () => {
  it("jsQR decodes the EIP-681 USDC-on-Base receive URI", async () => {
    const uri = buildEip681BaseUsdcReceiveUri(FIXTURE_RECIPIENT);
    expect(uri).toContain(getAddress(FIXTURE_RECIPIENT));
    expect(uri).toContain("@8453");

    const png = await QRCode.toBuffer(uri, { margin: 1, width: 200 });
    const payload = await decodeQrPngPayload(png);
    expect(payload).toBe(uri);
  });
});
