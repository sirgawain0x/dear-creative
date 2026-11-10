/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { SIGNUP_SRC_MAX_LENGTH } from "./signup-src";
import {
  readSignupSrcFromCookieHeader,
  readSignupSrcFromDocumentCookie,
  SIGNUP_SRC_COOKIE_MAX_AGE_SECONDS,
  SIGNUP_SRC_COOKIE_NAME,
  writeSignupSrcDocumentCookie,
} from "./signup-src-cookie";

function clearSignupSrcCookie(): void {
  document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

function installCookieWriteSpy(): { writes: string[]; restore: () => void } {
  const writes: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(document, "cookie");
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => "",
    set: (value: string) => {
      writes.push(value);
    },
  });
  return {
    writes,
    restore: () => {
      if (previous) {
        Object.defineProperty(document, "cookie", previous);
      }
    },
  };
}

describe("signup-src cookie", () => {
  afterEach(() => {
    clearSignupSrcCookie();
  });

  describe("writeSignupSrcDocumentCookie", () => {
    it("sanitizes values on write and read", () => {
      writeSignupSrcDocumentCookie("CTV");
      expect(readSignupSrcFromDocumentCookie()).toBe("ctv");
    });

    it("does not overwrite an existing valid cookie (first touch)", () => {
      document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=original; Path=/; SameSite=Lax; Secure; Max-Age=2592000`;
      writeSignupSrcDocumentCookie("new-src");
      expect(readSignupSrcFromDocumentCookie()).toBe("original");
    });

    it("replaces empty or invalid cookie values", () => {
      document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=; Path=/; Max-Age=2592000`;
      writeSignupSrcDocumentCookie("yt");
      expect(readSignupSrcFromDocumentCookie()).toBe("yt");

      clearSignupSrcCookie();
      document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=!!!; Path=/; Max-Age=2592000`;
      writeSignupSrcDocumentCookie("fb");
      expect(readSignupSrcFromDocumentCookie()).toBe("fb");
    });

    it("sets full attributes with Secure on https", () => {
      const locationStub = vi
        .spyOn(window, "location", "get")
        .mockReturnValue({ ...window.location, protocol: "https:" });
      const { writes, restore } = installCookieWriteSpy();
      try {
        writeSignupSrcDocumentCookie("yt");
        expect(writes).toHaveLength(1);
        expect(writes[0]).toBe(
          `${SIGNUP_SRC_COOKIE_NAME}=yt; Path=/; SameSite=Lax; Secure; Max-Age=${SIGNUP_SRC_COOKIE_MAX_AGE_SECONDS}`,
        );
      } finally {
        restore();
        locationStub.mockRestore();
      }
    });

    it("omits Secure on http", () => {
      const locationStub = vi
        .spyOn(window, "location", "get")
        .mockReturnValue({ ...window.location, protocol: "http:" });
      const { writes, restore } = installCookieWriteSpy();
      try {
        writeSignupSrcDocumentCookie("yt");
        expect(writes).toHaveLength(1);
        expect(writes[0]).toBe(
          `${SIGNUP_SRC_COOKIE_NAME}=yt; Path=/; SameSite=Lax; Max-Age=${SIGNUP_SRC_COOKIE_MAX_AGE_SECONDS}`,
        );
        expect(writes[0]).not.toContain("Secure");
      } finally {
        restore();
        locationStub.mockRestore();
      }
    });
  });

  describe("readSignupSrcFromCookieHeader", () => {
    it("rejects invalid and malicious cookie values", () => {
      expect(
        readSignupSrcFromCookieHeader(`${SIGNUP_SRC_COOKIE_NAME}=<script>`),
      ).toBe("script");
      expect(
        readSignupSrcFromCookieHeader(
          `${SIGNUP_SRC_COOKIE_NAME}=yt; other=1`,
        ),
      ).toBe("yt");
      expect(
        readSignupSrcFromCookieHeader(
          `${SIGNUP_SRC_COOKIE_NAME}=${encodeURIComponent("YT!!!")}`,
        ),
      ).toBe("yt");
      const overlong = "a".repeat(40);
      expect(
        readSignupSrcFromCookieHeader(`${SIGNUP_SRC_COOKIE_NAME}=${overlong}`)
          ?.length,
      ).toBe(SIGNUP_SRC_MAX_LENGTH);
      expect(
        readSignupSrcFromCookieHeader(`${SIGNUP_SRC_COOKIE_NAME}=!!!; other=x`),
      ).toBeNull();
      expect(
        readSignupSrcFromCookieHeader(`${SIGNUP_SRC_COOKIE_NAME}=a;b=c`),
      ).toBe("a");
    });
  });
});
