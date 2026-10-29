import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => async () => fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn(async () => undefined),
  };
});

const { getCachedActiveSubscriberCount } = vi.hoisted(() => ({
  getCachedActiveSubscriberCount: vi.fn(),
}));

vi.mock("@/lib/subscribers/cached-active-subscriber-count", () => ({
  getCachedActiveSubscriberCount,
}));

describe("GET /api/public/stats", () => {
  it("returns only activeSubscriberCount with cache-friendly headers", async () => {
    getCachedActiveSubscriberCount.mockResolvedValue(1284);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ activeSubscriberCount: 1284 });
    expect(Object.keys(body).sort()).toEqual(["activeSubscriberCount"]);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=600",
    );
  });

  it("returns zero when there are no active subscribers", async () => {
    getCachedActiveSubscriberCount.mockResolvedValue(0);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ activeSubscriberCount: 0 });
  });
});
