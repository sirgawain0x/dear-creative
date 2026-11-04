/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  persistSignupSrcFromSearch,
  readSignupSrcFromSession,
  SIGNUP_SRC_SESSION_KEY,
} from "./signup-src-session";

describe("signup-src session capture", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("persists sanitized src from the query string", () => {
    persistSignupSrcFromSearch("?src=CTV");
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBe("ctv");
    expect(readSignupSrcFromSession()).toBe("ctv");
  });

  it("does not store invalid src values", () => {
    persistSignupSrcFromSearch("?src=!!!");
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBeNull();
  });

  it("tolerates blocked sessionStorage on read and write", () => {
    const deny = () => {
      throw new DOMException("Access denied", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(deny);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(deny);

    expect(() => persistSignupSrcFromSearch("?src=yt")).not.toThrow();
    expect(readSignupSrcFromSession()).toBeNull();
  });
});
