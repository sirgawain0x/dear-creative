import { describe, expect, it } from "vitest";
import {
  buildKokoroTransformersEnvPatch,
  isBrowserCacheApiAvailable,
  isWebGpuAvailable,
  preferredKokoroInferenceDevice,
} from "./transformers-env-settings";

describe("Transformers.js env settings for Kokoro worker", () => {
  it("enables Cache API when caches exists and disables FS paths", () => {
    const patch = buildKokoroTransformersEnvPatch("3.8.1");
    expect(patch.allowRemoteModels).toBe(true);
    expect(patch.allowLocalModels).toBe(false);
    expect(patch.useFS).toBe(false);
    expect(patch.useFSCache).toBe(false);
    expect(patch.useCustomCache).toBe(false);
    expect(patch.useBrowserCache).toBe(isBrowserCacheApiAvailable());
    expect(patch.wasmPaths).toContain("@huggingface/transformers@3.8.1/dist/");
  });

  it("matches WebGPU availability for device preference", () => {
    expect(preferredKokoroInferenceDevice()).toBe(
      isWebGpuAvailable() ? "webgpu" : "wasm",
    );
  });
});
