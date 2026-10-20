import { describe, expect, it, vi } from "vitest";
import { fetchRenderArtifactBytes } from "./render-artifact";

describe("fetchRenderArtifactBytes", () => {
  it("decodes outputBase64 without touching local disk", async () => {
    const payload = Buffer.from("fake-mp4-bytes").toString("base64");
    const bytes = await fetchRenderArtifactBytes({ outputBase64: payload });
    expect(Buffer.from(bytes).toString()).toBe("fake-mp4-bytes");
  });

  it("downloads bytes when the renderer returns outputUrl", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    const bytes = await fetchRenderArtifactBytes(
      { outputUrl: "https://pixels.example.com/render/out.mp4" },
      fetchMock,
    );
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://pixels.example.com/render/out.mp4",
    );
  });

  it("rejects local outputPath responses", async () => {
    await expect(
      fetchRenderArtifactBytes({ outputPath: "/tmp/render.mp4" }),
    ).rejects.toThrow(/outputPath/);
  });
});
