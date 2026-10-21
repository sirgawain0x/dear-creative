import { afterEach, describe, expect, it } from "vitest";
import {
  isRepurposeMockEnabled,
  resetRepurposeMockEnvForTests,
  setRepurposeMockEnvForTests,
} from "./mock-mode";

describe("isRepurposeMockEnabled", () => {
  afterEach(() => {
    resetRepurposeMockEnvForTests();
  });

  it("is false in production even when REPURPOSE_MOCK_TTS is true", () => {
    setRepurposeMockEnvForTests({
      vercelEnv: "production",
      repurposeMockTts: "true",
    });
    expect(isRepurposeMockEnabled()).toBe(false);
  });

  it("is true in preview when REPURPOSE_MOCK_TTS is exactly true", () => {
    setRepurposeMockEnvForTests({
      vercelEnv: "preview",
      repurposeMockTts: "true",
    });
    expect(isRepurposeMockEnabled()).toBe(true);
  });

  it("is true when VERCEL_ENV is unset and flag is true", () => {
    setRepurposeMockEnvForTests({
      vercelEnv: undefined,
      repurposeMockTts: "true",
    });
    expect(isRepurposeMockEnabled()).toBe(true);
  });

  it("ignores TRUE and 1", () => {
    setRepurposeMockEnvForTests({
      vercelEnv: "preview",
      repurposeMockTts: "TRUE",
    });
    expect(isRepurposeMockEnabled()).toBe(false);

    setRepurposeMockEnvForTests({
      vercelEnv: "preview",
      repurposeMockTts: "1",
    });
    expect(isRepurposeMockEnabled()).toBe(false);
  });
});
