import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "python app.py",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: "4173",
      CYBERGUARD_SECRET_KEY: "playwright-test-secret",
      CYBERGUARD_DATABASE: "test-results/scoreboard-e2e.sqlite3",
    },
  },
});
