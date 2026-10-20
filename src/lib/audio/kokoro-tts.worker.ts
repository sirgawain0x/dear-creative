/// <reference lib="webworker" />

import { KokoroTTS, TextSplitterStream } from "kokoro-js";
import { env } from "@huggingface/transformers";
import {
  buildKokoroTransformersEnvPatch,
  preferredKokoroInferenceDevice,
} from "./transformers-env-settings";
import {
  KOKORO_DEFAULT_VOICE,
  KOKORO_DTYPE,
  KOKORO_MODEL_ID,
} from "./kokoro-config";

function applyTransformersEnvForKokoroWorker(): void {
  const patch = buildKokoroTransformersEnvPatch(env.version);
  env.allowRemoteModels = patch.allowRemoteModels;
  env.allowLocalModels = patch.allowLocalModels;
  env.useFS = patch.useFS;
  env.useFSCache = patch.useFSCache;
  env.useBrowserCache = patch.useBrowserCache;
  env.useCustomCache = patch.useCustomCache;
  env.customCache = patch.customCache;
  if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = patch.wasmPaths;
  }
}

applyTransformersEnvForKokoroWorker();

type WorkerInMessage =
  | { type: "init" }
  | {
      type: "speak";
      text: string;
      voice?: string;
      speed?: number;
      requestId: number;
    }
  | { type: "abort" };

type ProgressInfo = {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

let tts: KokoroTTS | null = null;
let activeDevice: "webgpu" | "wasm" | null = null;
let speakGeneration = 0;

async function loadModel(device: "webgpu" | "wasm"): Promise<KokoroTTS> {
  return KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
    dtype: KOKORO_DTYPE,
    device,
    progress_callback: (info: ProgressInfo) => {
      postMessage({ type: "progress", info });
    },
  });
}

async function ensureTts(): Promise<KokoroTTS> {
  if (tts) {
    return tts;
  }

  const primary = preferredKokoroInferenceDevice();

  if (primary === "webgpu") {
    try {
      tts = await loadModel("webgpu");
      activeDevice = "webgpu";
      postMessage({ type: "device", device: "webgpu" });
      return tts;
    } catch (webgpuError) {
      postMessage({
        type: "device-fallback",
        from: "webgpu",
        message:
          webgpuError instanceof Error
            ? webgpuError.message
            : String(webgpuError),
      });
    }
  }

  tts = await loadModel("wasm");
  activeDevice = "wasm";
  postMessage({ type: "device", device: "wasm" });
  return tts;
}

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      await ensureTts();
      postMessage({ type: "ready", device: activeDevice });
      return;
    }

    if (message.type === "abort") {
      speakGeneration += 1;
      postMessage({ type: "aborted" });
      return;
    }

    if (message.type === "speak") {
      const generation = ++speakGeneration;
      const model = await ensureTts();
      const voice = KOKORO_DEFAULT_VOICE;
      const speed = message.speed ?? 1;

      const splitter = new TextSplitterStream();
      const stream = model.stream(splitter, { voice, speed });

      const tokens = message.text.match(/\s*\S+/g) ?? [message.text];
      for (const token of tokens) {
        if (generation !== speakGeneration) {
          return;
        }
        splitter.push(token);
      }
      splitter.close();

      let chunkIndex = 0;
      for await (const chunk of stream) {
        if (generation !== speakGeneration) {
          return;
        }
        const samples = new Float32Array(chunk.audio.audio.length);
        samples.set(chunk.audio.audio);
        postMessage(
          {
            type: "chunk",
            requestId: message.requestId,
            chunkIndex,
            samplingRate: chunk.audio.sampling_rate,
            text: chunk.text,
            isFirst: chunkIndex === 0,
            samples,
          },
          [samples.buffer],
        );
        chunkIndex += 1;
      }

      if (generation === speakGeneration) {
        postMessage({ type: "done", requestId: message.requestId });
      }
    }
  } catch (error) {
    postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
