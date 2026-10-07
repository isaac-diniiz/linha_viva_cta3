import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers:
    process.env.DEMO_MODE || process.env.PUBLIC_DEMO_MODE ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL:
      process.env.DEMO_PUBLIC_URL ??
      (process.env.PUBLIC_DEMO_MODE
        ? "http://127.0.0.1:4173"
        : "http://127.0.0.1:5173"),
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer:
    process.env.PUBLIC_DEMO_MODE || process.env.EXTERNAL_DEMO_SERVER
      ? undefined
      : {
          command: process.env.DEMO_MODE
            ? "node node_modules/vite/bin/vite.js --host 0.0.0.0 --strictPort --mode demo"
            : "node node_modules/vite/bin/vite.js --host 127.0.0.1",
          url: "http://127.0.0.1:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
});
