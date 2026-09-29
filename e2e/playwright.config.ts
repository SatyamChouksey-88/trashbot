import { defineConfig } from "@playwright/test";

const baseURL = process.env.TRASHBOT_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL,
    browserName: "chromium",
  },
  workers: 1,
  projects: [{ name: "chromium" }],
  webServer: {
    command: "npm run mock",
    cwd: "../agent",
    url: `${baseURL}/api/status`,
    reuseExistingServer: !!process.env.PW_REUSE_SERVER,
    timeout: 60_000,
  },
});
