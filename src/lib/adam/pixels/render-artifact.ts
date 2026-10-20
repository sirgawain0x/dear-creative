export type PixelsRenderArtifactResponse = {
  outputPath?: string;
  outputUrl?: string;
  downloadUrl?: string;
  url?: string;
  outputBase64?: string;
};

export async function fetchRenderArtifactBytes(
  render: PixelsRenderArtifactResponse,
  fetchFn: typeof fetch = fetch,
): Promise<Uint8Array> {
  const base64 = render.outputBase64?.trim();
  if (base64) {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }

  const url =
    render.outputUrl?.trim() ||
    render.downloadUrl?.trim() ||
    render.url?.trim();
  if (url) {
    const response = await fetchFn(url);
    if (!response.ok) {
      throw new Error(`Failed to download render artifact (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  if (render.outputPath?.trim()) {
    throw new Error(
      "Render returned a local outputPath; expected outputUrl or outputBase64 for serverless upload",
    );
  }

  throw new Error("Render response missing outputUrl, outputBase64, or bytes");
}
