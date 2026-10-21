import { afterEach, describe, expect, it, vi } from "vitest";
import { setCowritersEnabledForTests } from "@/lib/cowriters/feature-flag";

const notFoundMock = vi.hoisted(() => vi.fn(() => undefined));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("./accept-cowriter-invite-client", () => ({
  default: () => null,
}));

describe("/cowriters/accept page gate", () => {
  afterEach(() => {
    setCowritersEnabledForTests(undefined);
    notFoundMock.mockClear();
  });

  it("calls notFound when COWRITERS_ENABLED is off", async () => {
    setCowritersEnabledForTests(false);
    const { default: Page } = await import("./page");
    Page();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("renders the client when co-writers are enabled", async () => {
    setCowritersEnabledForTests(true);
    const { default: Page } = await import("./page");
    Page();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
