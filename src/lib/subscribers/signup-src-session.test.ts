/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
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
});
