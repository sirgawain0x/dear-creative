import { describe, expect, it } from "vitest";
import {
  isAllowlistedCoverImageUrl,
  optimizedImageRemotePatterns,
  paragraphOptimizedPathAllowed,
  papyrusImagesPathAllowed,
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

  it("allows papyrus_images on storage.googleapis.com", () => {
    const url =
      "https://storage.googleapis.com/papyrus_images/1561f2d41303599b84b0b17bec1b224df57d01b39a51109b25adec70bfe7896c.png";
    expect(papyrusImagesPathAllowed("/papyrus_images/abc.png")).toBe(true);
    expect(isAllowlistedCoverImageUrl(url)).toBe(true);
  });

  it("rejects other storage.googleapis.com paths", () => {
    expect(papyrusImagesPathAllowed("/other-bucket/file.png")).toBe(false);
    expect(
      isAllowlistedCoverImageUrl(
        "https://storage.googleapis.com/other-bucket/file.png",
      ),
    ).toBe(false);
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
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/papyrus_images/**",
      },
    ]);
  });
});
