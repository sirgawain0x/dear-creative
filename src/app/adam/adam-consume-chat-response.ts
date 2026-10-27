export type AdamChatCompletionPayload = {
  reply: string;
  threadId?: string;
  createdDraft?: {
    postId: string;
    approvalId: string;
    slug: string;
    title: string;
  } | null;
  generatedBanner?: {
    url: string;
    uri: string;
  } | null;
};

export type AdamChatStreamEvent =
  | { type: "token"; textSoFar: string }
  | { type: "complete"; payload: AdamChatCompletionPayload };

const STREAM_REVEAL_MS = 14;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* revealReplyText(
  reply: string,
  reducedMotion: boolean,
): AsyncGenerator<AdamChatStreamEvent> {
  if (!reply || reducedMotion) {
    yield { type: "token", textSoFar: reply };
    return;
  }

  let acc = "";
  const parts = reply.split(/(\s+)/);
  for (const part of parts) {
    if (!part) continue;
    acc += part;
    yield { type: "token", textSoFar: acc };
    await sleep(STREAM_REVEAL_MS);
  }
}

function parseSseDataLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  return payload;
}

async function* consumeEventStreamBody(
  body: ReadableStream<Uint8Array>,
  reducedMotion: boolean,
): AsyncGenerator<AdamChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let textSoFar = "";
  let completion: AdamChatCompletionPayload | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const data = parseSseDataLine(line);
      if (!data) continue;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (typeof parsed.delta === "string" && parsed.delta) {
        textSoFar += parsed.delta;
        yield { type: "token", textSoFar };
      } else if (typeof parsed.token === "string" && parsed.token) {
        textSoFar += parsed.token;
        yield { type: "token", textSoFar };
      } else if (typeof parsed.reply === "string") {
        textSoFar = parsed.reply;
        yield { type: "token", textSoFar };
      }

      if (parsed.done === true || parsed.type === "complete") {
        completion = {
          reply: textSoFar || String(parsed.reply ?? ""),
          threadId:
            typeof parsed.threadId === "string" ? parsed.threadId : undefined,
          createdDraft:
            (parsed.createdDraft as AdamChatCompletionPayload["createdDraft"]) ??
            null,
          generatedBanner:
            (parsed.generatedBanner as AdamChatCompletionPayload["generatedBanner"]) ??
            null,
        };
      }
    }
  }

  if (completion) {
    yield { type: "complete", payload: completion };
    return;
  }

  if (textSoFar) {
    yield {
      type: "complete",
      payload: { reply: textSoFar },
    };
    return;
  }

  yield* revealReplyText("", reducedMotion);
}

export async function* consumeAdamChatResponse(
  response: Response,
  options: { reducedMotion: boolean },
): AsyncGenerator<AdamChatStreamEvent> {
  const contentType = response.headers.get("content-type") ?? "";

  if (
    contentType.includes("text/event-stream") ||
    contentType.includes("application/x-ndjson")
  ) {
    if (!response.body) {
      throw new Error("Empty streaming body from Adam.");
    }
    yield* consumeEventStreamBody(response.body, options.reducedMotion);
    return;
  }

  const data = (await response.json()) as {
    reply?: string;
    threadId?: string;
    createdDraft?: AdamChatCompletionPayload["createdDraft"];
    generatedBanner?: AdamChatCompletionPayload["generatedBanner"];
    error?: string;
  };

  const reply = data.reply ?? "";
  yield* revealReplyText(reply, options.reducedMotion);
  yield {
    type: "complete",
    payload: {
      reply,
      threadId: data.threadId,
      createdDraft: data.createdDraft ?? null,
      generatedBanner: data.generatedBanner ?? null,
    },
  };
}
