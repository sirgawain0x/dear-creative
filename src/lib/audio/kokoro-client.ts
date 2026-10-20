import { KokoroStreamPlayer } from "./kokoro-stream-player";

export type KokoroLoadProgress = {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

type WorkerOutMessage =
  | { type: "progress"; info: KokoroLoadProgress }
  | { type: "device"; device: "webgpu" | "wasm" }
  | { type: "device-fallback"; from: string; message: string }
  | { type: "ready"; device: "webgpu" | "wasm" | null }
  | {
      type: "chunk";
      requestId: number;
      chunkIndex: number;
      samplingRate: number;
      text: string;
      isFirst: boolean;
      samples: Float32Array;
    }
  | { type: "done"; requestId: number }
  | { type: "error"; message: string }
  | { type: "aborted" };

export type KokoroSpeakCallbacks = {
  onLoadProgress?: (progress: KokoroLoadProgress) => void;
  onDevice?: (device: "webgpu" | "wasm") => void;
  onFirstAudio?: () => void;
  onSentence?: (text: string) => void;
};

let sharedWorker: Worker | null = null;
let initPromise: Promise<void> | null = null;

function getWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL("./kokoro-tts.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return sharedWorker;
}

export function preloadKokoroModel(
  onProgress?: (progress: KokoroLoadProgress) => void,
): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  const worker = getWorker();

  initPromise = new Promise<void>((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerOutMessage>) => {
      const data = event.data;
      if (data.type === "progress") {
        onProgress?.(data.info);
        return;
      }
      if (data.type === "ready") {
        worker.removeEventListener("message", onMessage);
        resolve();
        return;
      }
      if (data.type === "error") {
        worker.removeEventListener("message", onMessage);
        initPromise = null;
        reject(new Error(data.message));
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage({ type: "init" });
  });

  return initPromise;
}

export class KokoroPlaybackSession {
  private readonly player = new KokoroStreamPlayer();
  private readonly worker = getWorker();
  private requestId = 0;
  private aborted = false;
  private onEnded: (() => void) | null = null;

  async start(text: string, callbacks: KokoroSpeakCallbacks): Promise<void> {
    this.aborted = false;
    await preloadKokoroModel(callbacks.onLoadProgress);

    const requestId = ++this.requestId;

    return new Promise<void>((resolve, reject) => {
      const onMessage = async (event: MessageEvent<WorkerOutMessage>) => {
        const data = event.data;

        if (data.type === "device") {
          callbacks.onDevice?.(data.device);
          return;
        }

        if (
          (data.type === "chunk" || data.type === "done") &&
          data.requestId !== requestId
        ) {
          return;
        }

        if (data.type === "chunk") {
          if (this.aborted) {
            return;
          }
          if (data.isFirst) {
            callbacks.onFirstAudio?.();
          }
          callbacks.onSentence?.(data.text);
          await this.player.enqueuePcm(data.samples, data.samplingRate);
          return;
        }

        if (data.type === "done") {
          this.worker.removeEventListener("message", onMessage);
          resolve();
          this.onEnded?.();
          return;
        }

        if (data.type === "error") {
          this.worker.removeEventListener("message", onMessage);
          reject(new Error(data.message));
        }
      };

      this.worker.addEventListener("message", onMessage);
      this.worker.postMessage({
        type: "speak",
        text,
        requestId,
        speed: 1,
      });
    });
  }

  setOnEnded(handler: () => void): void {
    this.onEnded = handler;
  }

  async pause(): Promise<void> {
    await this.player.pause();
  }

  async resume(): Promise<void> {
    await this.player.resume();
  }

  getCurrentTimeSec(): number {
    return this.player.currentTimeSec;
  }

  getEstimatedDurationSec(): number {
    return this.player.estimatedDurationSec;
  }

  async stop(): Promise<void> {
    this.aborted = true;
    this.worker.postMessage({ type: "abort" });
    await this.player.stop();
  }
}

export function resetKokoroClientForTests(): void {
  if (sharedWorker) {
    sharedWorker.terminate();
  }
  sharedWorker = null;
  initPromise = null;
}
