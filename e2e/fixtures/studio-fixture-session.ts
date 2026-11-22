import type { Page } from "@playwright/test";
import { ADAM_STUDIO_KEY_COOKIE } from "../../src/lib/adam/studio-access";
import { STUDIO_TOKEN_FIXTURE } from "./adam-posts-fixture";

export const PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000";

/**
 * Grants the server-side studio gate access for layout tests.
 *
 * The gate reads the httpOnly Studio Key cookie (localStorage is invisible to
 * the server). playwright.config.ts starts the app with
 * ADAM_API_TOKEN=STUDIO_TOKEN_FIXTURE so this cookie validates.
 */
export async function grantStudioFixtureAccess(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: ADAM_STUDIO_KEY_COOKIE,
      value: STUDIO_TOKEN_FIXTURE,
      url: PLAYWRIGHT_BASE_URL,
    },
  ]);
}
