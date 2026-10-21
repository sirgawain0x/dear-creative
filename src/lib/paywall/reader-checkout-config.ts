import {
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
  SUBSCRIPTION_PERIOD_DAYS,
  subscriptionMinConfirmations,
} from "@/lib/payments/subscription-config";
import { usdcSubscriptionAmountUnits } from "@/lib/payments/subscription-usdc-pricing";
import type { SubscriptionPlan } from "@/db/schema";

export {
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
  subscriptionMinConfirmations,
};

export const READER_SUBSCRIPTION_PLANS = ["monthly", "yearly"] as const satisfies readonly SubscriptionPlan[];

export function readerSubscriptionAmountRaw(plan: SubscriptionPlan): bigint {
  return usdcSubscriptionAmountUnits(plan);
}

export function readerSubscriptionPeriodMs(plan: SubscriptionPlan): number {
  const days = SUBSCRIPTION_PERIOD_DAYS[plan];
  return days * 24 * 60 * 60 * 1000;
}

/** Show renew prompt when subscription ends within this many days. */
export const READER_SUBSCRIPTION_RENEW_WINDOW_DAYS = 7;

export function readerSubscriptionRenewWindowMs(): number {
  return READER_SUBSCRIPTION_RENEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
