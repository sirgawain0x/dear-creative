import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readXOAuth1UserCredentials,
  resetXCredentialsLogForTests,
} from "./credentials";

describe("readXOAuth1UserCredentials", () => {
  beforeEach(() => {
    resetXCredentialsLogForTests();
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_ACCESS_TOKEN_SECRET;
    delete process.env.X_ACCESS_SECRET;
  });

  afterEach(() => {
    resetXCredentialsLogForTests();
  });

  it("prefers X_ACCESS_TOKEN_SECRET over X_ACCESS_SECRET", () => {
    process.env.X_API_KEY = "key";
    process.env.X_API_SECRET = "secret";
    process.env.X_ACCESS_TOKEN = "token";
    process.env.X_ACCESS_TOKEN_SECRET = "primary-secret";
    process.env.X_ACCESS_SECRET = "legacy-secret";

    expect(readXOAuth1UserCredentials()?.accessTokenSecret).toBe(
      "primary-secret",
    );
  });

  it("falls back to X_ACCESS_SECRET when X_ACCESS_TOKEN_SECRET is unset", () => {
    process.env.X_API_KEY = "key";
    process.env.X_API_SECRET = "secret";
    process.env.X_ACCESS_TOKEN = "token";
    process.env.X_ACCESS_SECRET = "legacy-secret";

    expect(readXOAuth1UserCredentials()?.accessTokenSecret).toBe(
      "legacy-secret",
    );
  });

  it("returns null when any required value is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(readXOAuth1UserCredentials()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("X_ACCESS_TOKEN_SECRET"),
    );
  });
});
