import { describe, expect, it, vi } from "vitest";
import {
  consumeAdamChatResponse,
  consumeEventStreamBody,
  MAX_JSON_REVEAL_MS,
} from "./adam-consume-chat-response";

async function collectEvents(
  response: Response,
  reducedMotion: boolean,
) {
  const events = [];
  for await (const event of consumeAdamChatResponse(response, {
    reducedMotion,
  })) {
    events.push(event);
  }
  return events;
}

describe("consumeAdamChatResponse", () => {
  it("reveals JSON replies in one token when reduced motion is on", async () => {
    const response = new Response(
      JSON.stringify({ reply: "Hello there", threadId: "thread_1" }),
      { headers: { "Content-Type": "application/json" } },
    );
    const events = await collectEvents(response, true);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: "token", textSoFar: "Hello there" });
    expect(events[1]).toMatchObject({
      type: "complete",
      payload: { reply: "Hello there", threadId: "thread_1" },
    });
  });

  it("caps simulated JSON reveal duration at about one second", async () => {
    vi.useFakeTimers();
    const response = new Response(
      JSON.stringify({
        reply: "word ".repeat(80).trim(),
      }),
      { headers: { "Content-Type": "application/json" } },
    );

    const events: unknown[] = [];
    const pending = (async () => {
      for await (const event of consumeAdamChatResponse(response, {
        reducedMotion: false,
      })) {
        events.push(event);
      }
    })();

    await vi.advanceTimersByTimeAsync(MAX_JSON_REVEAL_MS + 50);
    await pending;

    const tokens = events.filter(
      (e) => (e as { type?: string }).type === "token",
    );
    expect(tokens.length).toBeGreaterThan(1);
    vi.useRealTimers();
  });

  it("parses SSE payloads split across byte chunk boundaries", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"delta":"Hel'),
        );
        controller.enqueue(
          encoder.encode('lo"}\n\ndata: {"done":true,"reply":"Hello"}\n\n'),
        );
        controller.close();
      },
    });

    const events = [];
    for await (const event of consumeEventStreamBody(stream, true)) {
      events.push(event);
    }

    expect(events).toContainEqual({ type: "token", textSoFar: "Hello" });
    expect(events.at(-1)).toMatchObject({
      type: "complete",
      payload: { reply: "Hello" },
    });
  });
});
