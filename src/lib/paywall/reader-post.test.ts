import { afterEach, describe, expect, it, vi } from "vitest";
import { setPaywallEnabledForTests } from "./feature-flag";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
  })),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/lib/posts/published-posts", () => ({
  getPublishedPostRowBySlug: vi.fn(async () => null),
}));

import { connection } from "next/server";
import { resolveReaderPostView } from "./reader-post";

describe("resolveReaderPostView", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
    vi.mocked(connection).mockClear();
  });

  it("opts into request-time rendering before paywall date checks when paywall is enabled", async () => {
    setPaywallEnabledForTests(true);
    await resolveReaderPostView("any-slug");
    expect(connection).toHaveBeenCalled();
  });

  it("does not call connection when paywall is disabled", async () => {
    setPaywallEnabledForTests(false);
    await resolveReaderPostView("any-slug");
    expect(connection).not.toHaveBeenCalled();
  });
});
