import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_TOKEN_STORAGE_KEY } from "@/components/providers/app-providers";
import {
  adminApiAuthorizationHeaders,
  resolveAdminApiBearerToken,
} from "./admin-api-auth";

function mockBrowserStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      },
    },
  });
  return store;
}

describe("adminApiAuthorizationHeaders", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = mockBrowserStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to studio localStorage token when Privy getAccessToken returns null", async () => {
    store[STUDIO_TOKEN_STORAGE_KEY] = "studio-admin-key";

    const headers = await adminApiAuthorizationHeaders({
      privyConfigured: true,
      authenticated: true,
      getAccessToken: async () => null,
    });

    expect(headers).toEqual({ Authorization: "Bearer studio-admin-key" });
    expect(await resolveAdminApiBearerToken({
      privyConfigured: true,
      authenticated: true,
      getAccessToken: async () => null,
    })).toBe("studio-admin-key");
  });
});
