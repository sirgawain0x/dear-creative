import { defineConfig, devices } from "@playwright/test";
import { STUDIO_TOKEN_FIXTURE } from "./e2e/fixtures/adam-posts-fixture";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      READER_WALLET_ENABLED: "true",
      READER_WALLET_E2E_AUTH: "true",
      READER_WALLET_FIXTURE: "true",
      // Server-side studio gate: the layout tests present this as the Studio Key cookie.
      ADAM_API_TOKEN: STUDIO_TOKEN_FIXTURE,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
