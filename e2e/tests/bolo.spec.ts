import { test, expect } from "@playwright/test";

test.describe("Bolo UI on mock", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Bolo box renders on home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#bolo")).toBeVisible();
  });

  test("typing ruko triggers stop", async ({ page }) => {
    const stops: string[] = [];
    await page.route("**/api/stop", async (route) => {
      stops.push("stop");
      await route.continue();
    });
    await page.goto("/");
    const input = page.locator('.tb-bolo input[type="text"]');
    await input.fill("ruko");
    await input.press("Enter");
    await page.waitForTimeout(800);
    expect(stops.length).toBeGreaterThanOrEqual(1);
  });
});
