import {
  uploadToLensGrove,
  type LensGroveUploadResult,
} from "@/lib/storage/lens-grove";
import { generateRepurposeInfographicImage } from "../gemini-image";
import type { RepurposePostSource } from "../post-source";

export async function generateInfographic(input: {
  source: RepurposePostSource;
  fetchFn?: typeof fetch;
  uploadFn?: (
    file: File | Blob,
    fileName?: string,
  ) => Promise<LensGroveUploadResult>;
}): Promise<{
  payload: { model: string; promptTitle: string };
  mediaUrl: string;
  mediaMimeType: string;
}> {
  const image = await generateRepurposeInfographicImage({
    title: input.source.title,
    plainText: input.source.plainText,
    fetchFn: input.fetchFn,
  });

  const upload = input.uploadFn ?? uploadToLensGrove;
  const ext = image.mimeType.includes("jpeg") ? "jpg" : "png";
  const fileName = `${input.source.slug}-infographic.${ext}`;
  const bytes = Buffer.from(image.imageBase64, "base64");
  const uploaded = await upload(
    new File([new Uint8Array(bytes)], fileName, { type: image.mimeType }),
    fileName,
  );

  return {
    payload: { model: image.model, promptTitle: input.source.title },
    mediaUrl: uploaded.gatewayUrl,
    mediaMimeType: image.mimeType,
  };
}
