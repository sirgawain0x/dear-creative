import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("uploadToLensGrove", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes abort signal into Grove storage fetch calls", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input instanceof URL
              ? input.href
              : String(input);
      if (url.includes("/status/")) {
        return Response.json({ status: "available", storage_key: "key1" });
      }
      return Response.json([{ storage_key: "key1", uri: "lens://key1" }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { uploadToLensGrove } = await import("./lens-grove");
    const controller = new AbortController();
    const file = new File([new Uint8Array([1, 2, 3])], "clip.mp4", {
      type: "video/mp4",
    });

    await uploadToLensGrove(file, "clip.mp4", controller.signal);

    expect(fetchMock).toHaveBeenCalled();
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.signal).toBe(controller.signal);
    }
  });
});
