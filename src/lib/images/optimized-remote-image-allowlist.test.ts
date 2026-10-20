import { describe, expect, it } from "vitest";
import {
  isAllowlistedCoverImageUrl,
  optimizedImageRemotePatterns,
  paragraphOptimizedPathAllowed,
} from "./optimized-remote-image-allowlist";

describe("optimized-remote-image-allowlist", () => {
  it("allows paragraph cover paths that match remotePatterns", () => {
    expect(paragraphOptimizedPathAllowed("/p/my-post/cover.png")).toBe(true);
    expect(paragraphOptimizedPathAllowed("/@dear/issue/cover.png")).toBe(true);
    expect(isAllowlistedCoverImageUrl("https://paragraph.xyz/p/my-post/cover.png")).toBe(
      true,
    );
    expect(
      isAllowlistedCoverImageUrl("https://paragraph.xyz/@dear/issue/cover.png"),
    ).toBe(true);
  });

  it("rejects paragraph.xyz URLs outside /p/** and /@*/**", () => {
    expect(paragraphOptimizedPathAllowed("/static/logo.png")).toBe(false);
    expect(isAllowlistedCoverImageUrl("https://paragraph.xyz/static/logo.png")).toBe(
      false,
    );
  });

  it("keeps remotePatterns host/pathnames aligned with the path rules", () => {
    expect(optimizedImageRemotePatterns).toEqual([
      {
        protocol: "https",
        hostname: "paragraph.xyz",
        pathname: "/p/**",
      },
      {
        protocol: "https",
        hostname: "paragraph.xyz",
        pathname: "/@*/**",
      },
    ]);
  });
});
