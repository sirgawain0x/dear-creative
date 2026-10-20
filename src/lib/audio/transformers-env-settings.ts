/** Worker-safe feature detection (no @huggingface/transformers import). */

export function isBrowserCacheApiAvailable(): boolean {
  return typeof caches !== "undefined";
}

export function isWebGpuAvailable(): boolean {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return false;
  }
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter?: unknown } })
    .gpu;
  return typeof gpu?.requestAdapter === "function";
}

export type KokoroTransformersEnvPatch = {
  allowRemoteModels: boolean;
  allowLocalModels: boolean;
  useFS: boolean;
  useFSCache: boolean;
  useBrowserCache: boolean;
  useCustomCache: boolean;
  customCache: null;
  wasmPaths: string;
};

/**
 * Values applied to `env` before KokoroTTS.from_pretrained (Transformers.js docs: env API + WebGPU guide).
 */
export function buildKokoroTransformersEnvPatch(
  transformersVersion: string,
): KokoroTransformersEnvPatch {
  return {
    allowRemoteModels: true,
    allowLocalModels: false,
    useFS: false,
    useFSCache: false,
    useBrowserCache: isBrowserCacheApiAvailable(),
    useCustomCache: false,
    customCache: null,
    wasmPaths: `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${transformersVersion}/dist/`,
  };
}

export function preferredKokoroInferenceDevice(): "webgpu" | "wasm" {
  return isWebGpuAvailable() ? "webgpu" : "wasm";
}
