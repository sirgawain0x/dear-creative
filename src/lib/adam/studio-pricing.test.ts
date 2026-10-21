import { afterEach, describe, expect, it, vi } from "vitest";
import { repurposeOutputTypes } from "@/lib/adam/repurpose/types";
import {
  setRepurposePricingForTests,
} from "@/lib/adam/repurpose/feature-flag";
import {
  studioNativeOutputTypes,
  studioOutputTypes,
  type StudioOutputType,
} from "@/lib/adam/studio-output-types";
import {
  STUDIO_OUTPUT_USDC_UNITS,
  chargeUsdcUnitsForStudioOutput,
  usdCentsForStudioOutput,
  usdcUnitsForStudioOutput,
} from "@/lib/adam/studio-pricing";

const EXPECTED_USD_CENTS: Record<StudioOutputType, number> = {
  slide_deck: 99,
  report: 99,
  mind_map: 99,
  flashcards: 99,
  quiz: 99,
  data_table: 99,
  banner: 99,
  infographic: 149,
  narration: 199,
  audio_overview: 299,
  video_overview: 299,
  adam_video_8s: 499,
};

describe("STUDIO_OUTPUT_USDC_UNITS", () => {
  it("defines an integer USDC unit price for every studio output type", () => {
    for (const type of studioOutputTypes) {
      const units = STUDIO_OUTPUT_USDC_UNITS[type];
      expect(typeof units).toBe("bigint");
      expect(units > BigInt(0)).toBe(true);
      expect(units % BigInt(10_000)).toBe(BigInt(0));
    }
    expect(Object.keys(STUDIO_OUTPUT_USDC_UNITS).sort()).toEqual(
      [...studioOutputTypes].sort(),
    );
  });

  it("covers every repurpose output type and no extra keys", () => {
    for (const type of repurposeOutputTypes) {
      expect(STUDIO_OUTPUT_USDC_UNITS[type]).toBeDefined();
    }
    for (const type of studioNativeOutputTypes) {
      expect(STUDIO_OUTPUT_USDC_UNITS[type]).toBeDefined();
    }
  });

  it("matches the requested USD list prices", () => {
    for (const type of studioOutputTypes) {
      expect(usdCentsForStudioOutput(type)).toBe(EXPECTED_USD_CENTS[type]);
      expect(usdcUnitsForStudioOutput(type)).toBe(
        BigInt(EXPECTED_USD_CENTS[type] * 10_000),
      );
    }
  });
});

describe("chargeUsdcUnitsForStudioOutput", () => {
  afterEach(() => {
    setRepurposePricingForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("charges nothing when REPURPOSE_PRICING is off (default)", () => {
    vi.stubEnv("REPURPOSE_PRICING", "");
    for (const type of studioOutputTypes) {
      expect(chargeUsdcUnitsForStudioOutput(type)).toBe(BigInt(0));
    }
  });

  it("returns list price when REPURPOSE_PRICING is true", () => {
    setRepurposePricingForTests(true);
    for (const type of studioOutputTypes) {
      expect(chargeUsdcUnitsForStudioOutput(type)).toBe(
        usdcUnitsForStudioOutput(type),
      );
    }
  });
});
