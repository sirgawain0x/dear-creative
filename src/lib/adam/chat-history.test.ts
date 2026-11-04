import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { DearCreativeDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  addChatMessage,
  autoGenerateThreadTitle,
  createChatThread,
  deleteChatThread,
  getChatThreadWithMessages,
  listChatThreads,
  updateChatThread,
} from "./chat-history";

describe("chat-history", () => {
  let db: DearCreativeDb;
  let client: Client;

  beforeEach(async () => {
    client = createClient({ url: ":memory:" });
    db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  afterEach(() => {
    client.close();
  });

  it("auto-generates clean thread titles", () => {
    expect(
      autoGenerateThreadTitle(
        "Please help me draft an issue about Web3 curation and artists",
      ),
    ).toBe("Please help me draft an issue…");
    expect(autoGenerateThreadTitle("# Hello World")).toBe("Hello World");
    expect(autoGenerateThreadTitle("   ")).toBe("New Conversation");
  });

  it("denies delete when the caller does not own the thread", async () => {
    const thread = await createChatThread(db, {
      title: "Owned by B",
      ownerUserId: "did:privy:user-b",
    });
    const deleted = await deleteChatThread(db, thread.id, {
      actor: "did:privy:user-a",
      mode: "privy_admin",
    });
    expect(deleted).toBe(false);
    const stillThere = await getChatThreadWithMessages(db, thread.id, {
      actor: "did:privy:user-b",
      mode: "privy_admin",
    });
    expect(stillThere?.thread.id).toBe(thread.id);
  });

  it("creates, lists, updates, and deletes threads", async () => {
    const access = { actor: "did:privy:owner", mode: "privy_admin" as const };
    const thread = await createChatThread(db, {
      title: "Test Conversation",
      ownerUserId: access.actor,
    });
    expect(thread.id).toMatch(/^thread_/);
    expect(thread.title).toBe("Test Conversation");
    expect(thread.isArchived).toBe(false);

    const list = await listChatThreads(db, { access });
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(thread.id);

    const updated = await updateChatThread(
      db,
      thread.id,
      {
        title: "Renamed Thread",
        isArchived: true,
      },
      access,
    );
    expect(updated?.title).toBe("Renamed Thread");
    expect(updated?.isArchived).toBe(true);

    const activeList = await listChatThreads(db, {
      includeArchived: false,
      access,
    });
    expect(activeList.length).toBe(0);

    const allList = await listChatThreads(db, { includeArchived: true, access });
    expect(allList.length).toBe(1);

    const deleted = await deleteChatThread(db, thread.id, access);
    expect(deleted).toBe(true);
    const afterDelete = await listChatThreads(db, { includeArchived: true, access });
    expect(afterDelete.length).toBe(0);
  });

  it("adds and retrieves messages within a thread", async () => {
    const thread = await createChatThread(db);
    expect(thread.title).toBe("New Conversation");

    // Adding first user message should update title automatically
    const userMsg = await addChatMessage(db, {
      threadId: thread.id,
      role: "user",
      content: "Let's explore AI agents in digital publishing",
    });
    expect(userMsg.role).toBe("user");
    expect(userMsg.threadId).toBe(thread.id);

    // Adding model reply
    const modelMsg = await addChatMessage(db, {
      threadId: thread.id,
      role: "model",
      content: "That sounds like a fascinating topic. Here are three angles...",
      createdDraftPostId: null,
    });
    expect(modelMsg.role).toBe("model");

    const bundle = await getChatThreadWithMessages(db, thread.id);
    expect(bundle).not.toBeNull();
    expect(bundle?.thread.title).toBe("Lets explore AI agents in digital…");
    expect(bundle?.messages.length).toBe(2);
    expect(bundle?.messages[0]?.content).toBe(
      "Let's explore AI agents in digital publishing",
    );
    expect(bundle?.messages[1]?.content).toContain("That sounds like a fascinating topic");
  });

  it("self-heals on unmigrated database missing adam_chat_threads without throwing", async () => {
    const rawClient = createClient({ url: ":memory:" });
    const rawDb = drizzle({ client: rawClient, schema });
    // Intentionally DO NOT run drizzle migrations on rawDb
    const thread = await createChatThread(rawDb, { title: "Unmigrated DB Thread" });
    expect(thread.id).toMatch(/^thread_/);

    const message = await addChatMessage(rawDb, {
      threadId: thread.id,
      role: "user",
      content: "Hello on raw unmigrated DB",
    });
    expect(message.id).toMatch(/^msg_/);
    expect(message.content).toBe("Hello on raw unmigrated DB");

    const list = await listChatThreads(rawDb);
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(thread.id);

    rawClient.close();
  });
});
