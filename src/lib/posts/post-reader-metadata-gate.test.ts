import { afterEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import { gatePublishedPostReaderMetadataShell } from "./post-reader-metadata-gate";

describe("gatePublishedPostReaderMetadataShell", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
    notFoundMock.mockClear();
  });

  it("terminates during production build shell generation", () => {
    process.env.NEXT_PHASE = "phase-production-build";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    expect(() => gatePublishedPostReaderMetadataShell()).toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("terminates when NEXT_PUBLIC_SITE_URL is unset outside build", () => {
    delete process.env.NEXT_PHASE;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(() => gatePublishedPostReaderMetadataShell()).toThrow("NOT_FOUND");
  });

  it("allows request-time metadata when site URL is configured", () => {
    delete process.env.NEXT_PHASE;
    process.env.NEXT_PUBLIC_SITE_URL = "https://news.example.com";
    expect(() => gatePublishedPostReaderMetadataShell()).not.toThrow();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
