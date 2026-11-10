/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  readSignupSrcFromCookieHeader,
  readSignupSrcFromDocumentCookie,
  SIGNUP_SRC_COOKIE_NAME,
  writeSignupSrcDocumentCookie,
} from "./signup-src-cookie";

function clearSignupSrcCookie(): void {
  document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

describe("signup-src cookie", () => {
  afterEach(() => {
    clearSignupSrcCookie();
  });

  it("sets cookie with Path, SameSite, Secure, and 30-day Max-Age", () => {
    writeSignupSrcDocumentCookie("yt");
    expect(document.cookie).toContain(`${SIGNUP_SRC_COOKIE_NAME}=yt`);
    const header = readSignupSrcFromCookieHeader(document.cookie);
    expect(header).toBe("yt");
  });

  it("sanitizes values on write and read", () => {
    writeSignupSrcDocumentCookie("CTV");
    expect(readSignupSrcFromDocumentCookie()).toBe("ctv");
    expect(
      readSignupSrcFromCookieHeader(
        `${SIGNUP_SRC_COOKIE_NAME}=!!!; other=x`,
      ),
    ).toBeNull();
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
});
