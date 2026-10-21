import { isRepurposePricingConfigured } from "@/lib/adam/repurpose/feature-flag";
import {
  studioOutputTypes,
  type StudioOutputType,
} from "@/lib/adam/studio-output-types";

const USDC = (wholeAndFraction: number) => BigInt(wholeAndFraction);

/** Fixed USDC list prices (6 decimals) for Studio outputs, keyed by output type id. */
export const STUDIO_OUTPUT_USDC_UNITS: Record<StudioOutputType, bigint> = {
  slide_deck: USDC(990_000),
  report: USDC(990_000),
  mind_map: USDC(990_000),
  flashcards: USDC(990_000),
  quiz: USDC(990_000),
  data_table: USDC(990_000),
  banner: USDC(990_000),
  infographic: USDC(1_490_000),
  narration: USDC(1_990_000),
  audio_overview: USDC(2_990_000),
  video_overview: USDC(2_990_000),
  adam_video_8s: USDC(4_990_000),
};

const MICRO_USDC_PER_USD_CENT = BigInt(10_000);

export function usdcUnitsForStudioOutput(type: StudioOutputType): bigint {
  return STUDIO_OUTPUT_USDC_UNITS[type];
}

/** Billable amount for an output; zero when REPURPOSE_PRICING is off (no charges in v1). */
export function chargeUsdcUnitsForStudioOutput(type: StudioOutputType): bigint {
  if (!isRepurposePricingConfigured()) {
    return BigInt(0);
  }
  return usdcUnitsForStudioOutput(type);
}

/** Integer USD cents equivalent of the list price (derived from USDC base units). */
export function usdCentsForStudioOutput(type: StudioOutputType): number {
  return Number(usdcUnitsForStudioOutput(type) / MICRO_USDC_PER_USD_CENT);
}

export function studioOutputPriceCatalogForApi(): Record<
  StudioOutputType,
  string
> {
  const catalog = {} as Record<StudioOutputType, string>;
  for (const type of studioOutputTypes) {
    catalog[type] = usdcUnitsForStudioOutput(type).toString();
  }
  return catalog;
}
