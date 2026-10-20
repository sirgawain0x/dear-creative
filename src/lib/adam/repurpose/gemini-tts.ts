import { REPURPOSE_GEMINI_FETCH_TIMEOUT_MS } from "./constants";

function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim() ||
    null
  );
}

function getTtsModel(): string {
  return (
    process.env.REPURPOSE_GEMINI_TTS_MODEL?.trim() ||
    process.env.ADAM_GEMINI_TTS_MODEL?.trim() ||
    "gemini-3.8-flash-tts"
  );
}

export type PodcastSegment = {
  speaker: "host_a" | "host_b";
  text: string;
};

function buildMultiSpeakerTranscript(segments: PodcastSegment[]): string {
  return segments
    .map((segment) => {
      const label = segment.speaker === "host_b" ? "Speaker 2" : "Speaker 1";
      return `${label}: ${segment.text.trim()}`;
    })
    .join("\n");
}

export async function synthesizePodcastMultiSpeaker(input: {
  segments: PodcastSegment[];
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<{ audioBase64: string; mimeType: string; provider: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  if (input.segments.length === 0) {
    throw new Error("Podcast script has no segments.");
  }

  const fetchImpl = input.fetchFn ?? fetch;
  const model = getTtsModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
  const transcript = buildMultiSpeakerTranscript(input.segments);
  const timeoutMs = input.timeoutMs ?? REPURPOSE_GEMINI_FETCH_TIMEOUT_MS;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: transcript }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: "Speaker 1",
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Puck" },
                },
              },
              {
                speaker: "Speaker 2",
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Aoede" },
                },
              },
            ],
          },
        },
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Gemini multi-speaker TTS failed (${response.status})`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };
  const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
    ?.inlineData;
  if (!inline?.data) {
    throw new Error("Empty multi-speaker TTS response");
  }

  return {
    audioBase64: inline.data,
    mimeType: inline.mimeType || "audio/mp3",
    provider: "gemini-3.8-flash-tts",
  };
}
