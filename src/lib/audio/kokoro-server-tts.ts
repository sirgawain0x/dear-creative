import {
  getKokoroTtsTimeoutMs,
  KOKORO_NARRATION_VOICE,
} from "./narration-provider";

export type KokoroServerSpeechResult = {
  audioBase64: string;
  mimeType: "audio/mpeg";
  provider: "kokoro-cloud-run";
};

export class KokoroTtsTimeoutError extends Error {
  constructor(message = "Kokoro TTS request timed out") {
    super(message);
    this.name = "KokoroTtsTimeoutError";
  }
}

export class KokoroTtsHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "KokoroTtsHttpError";
    this.status = status;
  }
}

function getKokoroTtsBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const url = env.KOKORO_TTS_BASE_URL?.trim();
  return url || null;
}

function getKokoroTtsToken(env: NodeJS.ProcessEnv = process.env): string | null {
  const token = env.KOKORO_TTS_TOKEN?.trim();
  return token || null;
}

export function isKokoroServerConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(getKokoroTtsBaseUrl(env) && getKokoroTtsToken(env));
}

/**
 * Calls the Cloud Run Kokoro synthesize endpoint (MP3, af_heart by default).
 */
export async function synthesizeSpeechWithKokoroServer(input: {
  text: string;
  voice?: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}): Promise<KokoroServerSpeechResult> {
  const env = input.env ?? process.env;
  const baseUrl = getKokoroTtsBaseUrl(env);
  const token = getKokoroTtsToken(env);
  if (!baseUrl || !token) {
    throw new Error(
      "Kokoro TTS is not configured (set KOKORO_TTS_BASE_URL and KOKORO_TTS_TOKEN).",
    );
  }

  const timeoutMs = getKokoroTtsTimeoutMs(env);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const outerSignal = input.signal;
  if (outerSignal) {
    if (outerSignal.aborted) {
      clearTimeout(timeoutId);
      throw new KokoroTtsTimeoutError();
    }
    outerSignal.addEventListener(
      "abort",
      () => controller.abort(),
      { once: true },
    );
  }

  const fetchImpl = input.fetchFn ?? fetch;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/synthesize`;

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: input.text,
        voice: input.voice?.trim() || KOKORO_NARRATION_VOICE,
        format: "mp3",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new KokoroTtsHttpError(
        response.status,
        detail || `Kokoro TTS HTTP ${response.status}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: buffer.toString("base64"),
      mimeType: "audio/mpeg",
      provider: "kokoro-cloud-run",
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw new KokoroTtsTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
