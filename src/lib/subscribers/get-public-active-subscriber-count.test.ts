import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_SUBSCRIBER_COUNT_ERROR_CODE,
  getPublicActiveSubscriberCount,
} from "./get-public-active-subscriber-count";

vi.mock("./cached-active-subscriber-count", () => ({
  getCachedActiveSubscriberCount: vi.fn(),
}));

const { getCachedActiveSubscriberCount } = await import(
  "./cached-active-subscriber-count"
);

describe("getPublicActiveSubscriberCount", () => {
  afterEach(() => {
    vi.mocked(getCachedActiveSubscriberCount).mockReset();
  });

  it("returns null when count is zero", async () => {
    vi.mocked(getCachedActiveSubscriberCount).mockResolvedValue(0);
    expect(await getPublicActiveSubscriberCount()).toBeNull();
  });

  it("returns null and logs when the query throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getCachedActiveSubscriberCount).mockRejectedValue(
      new Error("db unavailable"),
    );

    expect(await getPublicActiveSubscriberCount()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      `[${ACTIVE_SUBSCRIBER_COUNT_ERROR_CODE}]`,
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it("returns the count when positive", async () => {
    vi.mocked(getCachedActiveSubscriberCount).mockResolvedValue(42);
    expect(await getPublicActiveSubscriberCount()).toBe(42);
  });
});
