import { afterEach, describe, expect, it, vi } from "vitest";
import { setAuthorProfilesEnabledForTests } from "./feature-flag";

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/authors/author-profile", () => ({
  getAuthorProfileById: vi.fn(),
}));

import { getDb } from "@/db/client";
import { getAuthorProfileById } from "@/lib/authors/author-profile";
import { gateAuthorProfilePage } from "./gate-author-profile-page";

describe("gateAuthorProfilePage", () => {
  afterEach(() => {
    setAuthorProfilesEnabledForTests(undefined);
    notFoundMock.mockClear();
    vi.mocked(getAuthorProfileById).mockReset();
  });

  it("terminates with notFound when the feature flag is off", async () => {
    setAuthorProfilesEnabledForTests(false);
    await expect(gateAuthorProfilePage("any-id")).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getAuthorProfileById).not.toHaveBeenCalled();
  });

  it("terminates with notFound when the author record is missing", async () => {
    setAuthorProfilesEnabledForTests(true);
    vi.mocked(getDb).mockReturnValue({} as ReturnType<typeof getDb>);
    vi.mocked(getAuthorProfileById).mockResolvedValue(null);
    await expect(gateAuthorProfilePage("missing")).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
