import { test, expect } from "@playwright/test";

test.describe("Bolo UI on mock", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function mountBolo(page: import("@playwright/test").Page) {
    await page.goto("/");
    await page.waitForSelector(".tb-bolo input", { timeout: 15_000 });
  }

  async function say(page: import("@playwright/test").Page, text: string) {
    await page.fill(".tb-bolo input", text);
    await page.locator(".tb-bolo button.send").click();
    await page.waitForTimeout(300);
  }

  test("Bolo box renders on home page", async ({ page }) => {
    await mountBolo(page);
    await expect(page.locator(".tb-bolo")).toBeVisible();
  });

  test("@hil typing ruko triggers stop", async ({ page }) => {
    const stopReq = page.waitForRequest((r) => r.url().includes("/api/stop") && r.method() === "POST");
    await mountBolo(page);
    await say(page, "ruko");
    await stopReq;
  });

  test("@hil Devanagari रुको triggers stop", async ({ page }) => {
    const stopReq = page.waitForRequest((r) => r.url().includes("/api/stop") && r.method() === "POST");
    await mountBolo(page);
    await say(page, "रुको");
    await stopReq;
  });

  test("@hil 20 cm aage posts move", async ({ page }) => {
    const moveReq = page.waitForRequest(
      (r) => r.url().includes("/api/move") && r.method() === "POST",
    );
    await mountBolo(page);
    await say(page, "20 cm aage chalo");
    const req = await moveReq;
    const body = req.postDataJSON() as { distance_cm?: number };
    expect(body.distance_cm).toBe(20);
  });

  test("ghumo shows chips and turn posts", async ({ page }) => {
    await mountBolo(page);
    await say(page, "ghumo");
    await expect(page.locator(".tb-bolo [data-r='chips'] button")).toHaveCount(3);
    const turnReq = page.waitForRequest((r) => r.url().includes("/api/turn") && r.method() === "POST");
    await page.locator(".tb-bolo [data-r='chips'] button").nth(1).click();
    await turnReq;
  });

  test("@hil photo lo fetches photo", async ({ page }) => {
    const photoReq = page.waitForResponse((r) => r.url().includes("/api/photo") && r.ok());
    await mountBolo(page);
    await say(page, "photo lo");
    await photoReq;
  });

  test("battery kitni hai shows reply", async ({ page }) => {
    await mountBolo(page);
    await say(page, "battery kitni hai");
    await expect(page.locator(".tb-bolo [data-r='reply']")).toContainText(/Battery|band hai|V|volt/i);
  });

  test("@hil estop then reset flow", async ({ page }) => {
    await mountBolo(page);
    const estopReq = page.waitForRequest((r) => r.url().includes("/api/estop") && r.method() === "POST");
    await say(page, "emergency");
    await estopReq;
    await say(page, "20 cm aage");
    await expect(page.locator(".tb-bolo [data-r='reply']")).toContainText(/Emergency|emergency|ESTOP|laga/i);
  });
});
