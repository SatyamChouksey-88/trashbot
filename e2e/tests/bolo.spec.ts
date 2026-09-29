import { test, expect } from "@playwright/test";

test.describe("Bolo UI on mock", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Bolo box renders on home page", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".tb-bolo input", { timeout: 15_000 });
    await expect(page.locator(".tb-bolo")).toBeVisible();
  });

  test("typing ruko triggers stop", async ({ page }) => {
    const stopReq = page.waitForRequest((r) => r.url().includes("/api/stop") && r.method() === "POST");
    await page.goto("/");
    await page.waitForSelector(".tb-bolo input", { timeout: 15_000 });
    await page.fill(".tb-bolo input", "ruko");
    await page.locator(".tb-bolo button.send").click();
    await stopReq;
  });
});
