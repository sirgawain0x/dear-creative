import { describe, expect, it } from "vitest";
import { canAccessChatThread } from "./chat-thread-access";

describe("canAccessChatThread", () => {
  it("allows studio admins to access legacy null-owner threads", () => {
    expect(
      canAccessChatThread(
        { ownerUserId: null },
        { actor: "did:privy:user-a", mode: "privy_admin" },
      ),
    ).toBe(true);
  });

  it("denies access when owner differs from caller", () => {
    expect(
      canAccessChatThread(
        { ownerUserId: "did:privy:user-b" },
        { actor: "did:privy:user-a", mode: "privy_admin" },
      ),
    ).toBe(false);
  });

  it("allows adam service token to access any thread", () => {
    expect(
      canAccessChatThread(
        { ownerUserId: "did:privy:user-b" },
        { actor: "adam-token", mode: "adam_token" },
      ),
    ).toBe(true);
  });
});
