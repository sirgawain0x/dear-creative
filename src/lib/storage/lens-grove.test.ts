import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadFileMock = vi.hoisted(() => vi.fn());

vi.mock("@lens-chain/storage-client", () => ({
  StorageClient: class MockStorageClient {
    static create() {
      return {
        uploadFile: uploadFileMock,
        resolve: (uri: string) =>
          `https://api.grove.storage/${uri.replace(/^lens:\/\//, "")}`,
      };
    }
  },
}));

describe("uploadToLensGrove", () => {
  beforeEach(() => {
    vi.resetModules();
    uploadFileMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("passes abort signal to direct fallback fetch when the client upload fails", async () => {
    uploadFileMock.mockRejectedValueOnce(new Error("client failed"));
    const fetchMock = vi.fn(async () =>
      Response.json([{ storage_key: "key1", uri: "lens://key1" }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { uploadToLensGrove } = await import("./lens-grove");
    const controller = new AbortController();
    const file = new File([new Uint8Array([1, 2, 3])], "clip.mp4", {
      type: "video/mp4",
    });

    await uploadToLensGrove(file, "clip.mp4", controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.grove.storage?chain_id=232",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("does not replace globalThis.fetch during overlapping uploads", async () => {
    let releaseSecondUpload!: () => void;
    const secondUploadGate = new Promise<void>((resolve) => {
      releaseSecondUpload = resolve;
    });

    uploadFileMock
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(async () => {
        expect(globalThis.fetch).toBe(fetchAtStart);
        await secondUploadGate;
        return {
          uri: "lens://key2",
          gatewayUrl: "https://api.grove.storage/key2",
          storageKey: "key2",
        };
      });

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof Request
              ? input.url
              : input instanceof URL
                ? input.href
                : String(input);
        if (url.includes("unrelated.example")) {
          if (init?.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          return new Response("ok");
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const fetchAtStart = globalThis.fetch;
    expect(fetchAtStart).toBe(fetchMock);

    const { uploadToLensGrove } = await import("./lens-grove");
    const abortTimedUpload = new AbortController();
    const fileA = new File([new Uint8Array([1])], "a.mp4", {
      type: "video/mp4",
    });
    const fileB = new File([new Uint8Array([2])], "b.mp4", {
      type: "video/mp4",
    });

    const timedUpload = uploadToLensGrove(
      fileA,
      "a.mp4",
      abortTimedUpload.signal,
    );
    expect(globalThis.fetch).toBe(fetchAtStart);

    const concurrentUpload = uploadToLensGrove(fileB, "b.mp4");
    expect(globalThis.fetch).toBe(fetchAtStart);

    const unrelatedFetch = globalThis.fetch("https://unrelated.example/ping");
    expect(globalThis.fetch).toBe(fetchAtStart);

    abortTimedUpload.abort();
    await expect(timedUpload).rejects.toMatchObject({ name: "AbortError" });
    await expect(unrelatedFetch).resolves.toMatchObject({ ok: true });

    releaseSecondUpload();
    await expect(concurrentUpload).resolves.toMatchObject({
      storageKey: "key2",
    });
    expect(globalThis.fetch).toBe(fetchAtStart);
  });
});
