import { describe, expect, it } from "vitest";
import { consumeAdamChatResponse } from "./adam-consume-chat-response";

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

  it("streams JSON replies word-by-word when motion is allowed", async () => {
    const response = new Response(JSON.stringify({ reply: "Hi friend" }), {
      headers: { "Content-Type": "application/json" },
    });
    const events = await collectEvents(response, false);
    const tokens = events.filter((e) => e.type === "token");
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.at(-1)).toEqual({ type: "token", textSoFar: "Hi friend" });
  });
});
