import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@libsql/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@libsql/client")>();
  return {
    ...actual,
    createClient: vi.fn(),
  };
});

import {
  ProxyPublishedLookupUnavailableError,
  existsPublishedPostBySlugForProxy,
  isProxyDatabaseConfigured,
  resetProxyLibsqlClientForTests,
} from "./published-post-exists-proxy";

describe("existsPublishedPostBySlugForProxy", () => {
  beforeEach(() => {
    resetProxyLibsqlClientForTests();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetProxyLibsqlClientForTests();
  });

  it("throws when no database env is configured", async () => {
    vi.stubEnv("TURSO_DATABASE_URL", "");
    vi.stubEnv("TURSO_AUTH_TOKEN", "");
    vi.stubEnv("LOCAL_DATABASE_URL", "");
    expect(isProxyDatabaseConfigured()).toBe(false);
    await expect(
      existsPublishedPostBySlugForProxy("any-slug"),
    ).rejects.toBeInstanceOf(ProxyPublishedLookupUnavailableError);
  });

  it("reuses a single module-level libsql client across lookups", async () => {
    vi.stubEnv("LOCAL_DATABASE_URL", ":memory:");
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    vi.mocked(createClient).mockReturnValue({ execute } as never);
    await existsPublishedPostBySlugForProxy("first-slug");
    await existsPublishedPostBySlugForProxy("second-slug");
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("passes published_at cutoff as milliseconds for libsql integer column", async () => {
    vi.stubEnv("LOCAL_DATABASE_URL", ":memory:");
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    vi.mocked(createClient).mockReturnValue({ execute } as never);
    const before = Date.now();
    await existsPublishedPostBySlugForProxy("live-post");
    const asOfArg = execute.mock.calls[0]?.[0]?.args?.[1] as number;
    expect(asOfArg).toBeGreaterThanOrEqual(before);
    expect(asOfArg).toBeLessThanOrEqual(Date.now() + 5_000);
    expect(asOfArg).toBeGreaterThan(1_000_000_000_000);
  });

  it("only executes SELECT statements against libsql", async () => {
    vi.stubEnv("LOCAL_DATABASE_URL", ":memory:");
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: "p1" }] });
    vi.mocked(createClient).mockReturnValue({ execute } as never);
    await existsPublishedPostBySlugForProxy("live-post");
    const statement = execute.mock.calls[0]?.[0] as { sql: string };
    expect(statement.sql.trim().toUpperCase()).toMatch(/^SELECT /);
    expect(statement.sql.toUpperCase()).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE)\b/,
    );
  });
});
