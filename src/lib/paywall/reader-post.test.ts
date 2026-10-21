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
import {
  resolvePublicPostForMetadata,
  resolveReaderPostView,
} from "./reader-post";

describe("post slug reader connection", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
    vi.mocked(connection).mockClear();
  });

  it("calls connection before published visibility Date checks when paywall is enabled", async () => {
    setPaywallEnabledForTests(true);
    await resolveReaderPostView("any-slug");
    expect(connection).toHaveBeenCalled();
  });

  it("calls connection before published visibility Date checks when paywall is disabled", async () => {
    setPaywallEnabledForTests(false);
    await resolveReaderPostView("any-slug");
    expect(connection).toHaveBeenCalled();
  });

  it("calls connection for metadata resolution when paywall is enabled", async () => {
    setPaywallEnabledForTests(true);
    await resolvePublicPostForMetadata("any-slug");
    expect(connection).toHaveBeenCalled();
  });

  it("calls connection for metadata resolution when paywall is disabled", async () => {
    setPaywallEnabledForTests(false);
    await resolvePublicPostForMetadata("any-slug");
    expect(connection).toHaveBeenCalled();
  });
});
