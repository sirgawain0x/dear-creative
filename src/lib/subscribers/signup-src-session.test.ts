/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { SIGNUP_SRC_COOKIE_NAME } from "./signup-src-cookie";
import {
  persistSignupSrcFromSearch,
  readSignupSrcForSubscribe,
  readSignupSrcFromSession,
  SIGNUP_SRC_SESSION_KEY,
} from "./signup-src-session";

function clearSignupSrcCookie(): void {
  document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

describe("signup-src session capture", () => {
  afterEach(() => {
    sessionStorage.clear();
    clearSignupSrcCookie();
    vi.restoreAllMocks();
  });

  it("persists sanitized src from the query string to session and cookie", () => {
    persistSignupSrcFromSearch("?src=CTV");
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBe("ctv");
    expect(readSignupSrcFromSession()).toBe("ctv");
    expect(document.cookie).toContain(`${SIGNUP_SRC_COOKIE_NAME}=ctv`);
  });

  it("does not store invalid src values", () => {
    persistSignupSrcFromSearch("?src=!!!");
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBeNull();
    expect(document.cookie).not.toContain(`${SIGNUP_SRC_COOKIE_NAME}=`);
  });

  it("does not overwrite when a valid cookie already exists", () => {
    document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=yt; Path=/; SameSite=Lax; Secure; Max-Age=2592000`;
    persistSignupSrcFromSearch("?src=new");
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBeNull();
    expect(document.cookie).toContain(`${SIGNUP_SRC_COOKIE_NAME}=yt`);
  });

  it("does not overwrite when session already has a valid src", () => {
    sessionStorage.setItem(SIGNUP_SRC_SESSION_KEY, "original");
    persistSignupSrcFromSearch("?src=new");
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBe("original");
  });

  it("backfills cookie when session is valid but cookie is missing", () => {
    sessionStorage.setItem(SIGNUP_SRC_SESSION_KEY, "session-only");
    persistSignupSrcFromSearch("");
    expect(document.cookie).toContain(`${SIGNUP_SRC_COOKIE_NAME}=session-only`);
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBe("session-only");
  });

  it("backfills cookie on navigation with new src without overwriting session", () => {
    sessionStorage.setItem(SIGNUP_SRC_SESSION_KEY, "keep-me");
    persistSignupSrcFromSearch("?src=attacker");
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBe("keep-me");
    expect(document.cookie).toContain(`${SIGNUP_SRC_COOKIE_NAME}=keep-me`);
  });

  it("readSignupSrcForSubscribe falls back to cookie when session is cleared", () => {
    document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=persisted; Path=/; SameSite=Lax; Secure; Max-Age=2592000`;
    sessionStorage.clear();
    expect(readSignupSrcFromSession()).toBeNull();
    expect(readSignupSrcForSubscribe()).toBe("persisted");
  });

  it("readSignupSrcForSubscribe prefers session over cookie", () => {
    sessionStorage.setItem(SIGNUP_SRC_SESSION_KEY, "session-val");
    document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=cookie-val; Path=/; Max-Age=2592000`;
    expect(readSignupSrcForSubscribe()).toBe("session-val");
  });

  it("still writes cookie when sessionStorage getItem/setItem throw", () => {
    const deny = () => {
      throw new DOMException("Access denied", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(deny);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(deny);

    expect(() => persistSignupSrcFromSearch("?src=yt")).not.toThrow();
    expect(readSignupSrcFromSession()).toBeNull();
    expect(document.cookie).toContain(`${SIGNUP_SRC_COOKIE_NAME}=yt`);
  });
});
