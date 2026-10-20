import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readStudioTokenFromStorage,
  resolveStudioBearerToken,
} from "./studio-bearer-token";
import { STUDIO_TOKEN_STORAGE_KEY } from "@/components/providers/app-providers";

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

describe("resolveStudioBearerToken", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = mockBrowserStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("prefers Privy access token when authenticated", async () => {
    const getAccessToken = vi.fn(async () => "privy-token");
    store[STUDIO_TOKEN_STORAGE_KEY] = "studio-key";

    const token = await resolveStudioBearerToken({
      privyConfigured: true,
      authenticated: true,
      getAccessToken,
      studioTokenFromStorage: readStudioTokenFromStorage(),
    });

    expect(token).toBe("privy-token");
    expect(getAccessToken).toHaveBeenCalledOnce();
  });

  it("falls back to localStorage studio token when getAccessToken throws", async () => {
    store[STUDIO_TOKEN_STORAGE_KEY] = "studio-key";

    const token = await resolveStudioBearerToken({
      privyConfigured: true,
      authenticated: true,
      getAccessToken: async () => {
        throw new Error("privy unavailable");
      },
      studioTokenFromStorage: readStudioTokenFromStorage(),
    });

    expect(token).toBe("studio-key");
  });

  it("falls back to localStorage studio token when Privy token is missing", async () => {
    store[STUDIO_TOKEN_STORAGE_KEY] = "studio-key";

    const token = await resolveStudioBearerToken({
      privyConfigured: true,
      authenticated: true,
      getAccessToken: async () => null,
      studioTokenFromStorage: readStudioTokenFromStorage(),
    });

    expect(token).toBe("studio-key");
  });

  it("uses studio token when Privy is not configured", async () => {
    store[STUDIO_TOKEN_STORAGE_KEY] = "studio-only";

    const token = await resolveStudioBearerToken({
      privyConfigured: false,
      authenticated: false,
      getAccessToken: async () => null,
      studioTokenFromStorage: readStudioTokenFromStorage(),
    });

    expect(token).toBe("studio-only");
  });
});
