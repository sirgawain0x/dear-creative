/** Mock chat thread messages that stress mobile overflow (URLs, images, code). */
export const ADAM_CHAT_OVERFLOW_THREAD_ID = "thread_fixture_overflow";

export function buildAdamChatOverflowThreadList() {
  const now = new Date().toISOString();
  return [
    {
      id: ADAM_CHAT_OVERFLOW_THREAD_ID,
      title: "Overflow fixture",
      summary: null,
      updatedAt: now,
      createdAt: now,
    },
  ];
}

export const ADAM_CHAT_SHORT_REPLY = "Sure — noted.";

const longUrl =
  "https://dearcreative.example/editorial/studio/chat-with-adam/threads/" +
  "fixture-overflow-test?ref=mobile-layout&token=" +
  "a".repeat(80);

const longWord = "supercalifragilisticexpialidocious".repeat(4);

const wideImageMarkdown =
  "![Generated banner fixture](https://placehold.co/2400x900/png?text=Wide+Generated+Image)";

const wideCodeMarkdown =
  "```typescript\nconst payload = {\n  id: '" +
  "x".repeat(240) +
  "', note: 'fixture wide code block' };\n```";

export function buildAdamChatOverflowMessages() {
  return [
    {
      role: "user" as const,
      content: longUrl,
    },
    {
      role: "assistant" as const,
      content: ADAM_CHAT_SHORT_REPLY,
    },
    {
      role: "assistant" as const,
      content: longWord,
    },
    {
      role: "assistant" as const,
      content: wideImageMarkdown,
    },
    {
      role: "assistant" as const,
      content: wideCodeMarkdown,
    },
  ];
}

export const ADAM_CHAT_OVERFLOW_SCREENSHOT_DIR =
  "docs/pr-assets/adam-chat-mobile-overflow";
