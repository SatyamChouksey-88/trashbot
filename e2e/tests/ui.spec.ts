import { test, expect } from "@playwright/test";

test.describe("TrashBot web UI", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hold FWD sends drive about every 200ms then stops on release", async ({ page }) => {
    const drives: number[] = [];
    await page.route("**/api/drive", async (route) => {
      drives.push(Date.now());
      const res = await route.fetch();
      await route.fulfill({ response: res });
    });
    await page.goto("/");
    const fwd = page.getByRole("button", { name: "FWD" });
    const box = await fwd.boundingBox();
    if (!box) throw new Error("no FWD button");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await page.waitForTimeout(100);
    expect(drives.length).toBeGreaterThanOrEqual(2);
    const gaps = drives.slice(1).map((t, i) => t - drives[i]);
    expect(gaps.some((g) => g >= 150 && g <= 350)).toBeTruthy();
  });

  test("STOP and ESTOP reset", async ({ page }) => {
    await page.goto("/");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/stop") && r.ok()),
      page.getByTestId("drive-stop").click(),
    ]);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/estop") && r.ok()),
      page.getByTestId("drive-estop").click(),
    ]);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/estop/reset") && r.ok()),
      page.getByRole("button", { name: "Reset ESTOP" }).click(),
    ]);
  });

  test("Auto tab start updates session pre", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Auto" }).click();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/clean") && r.ok()),
      page.getByTestId("auto-clean").click(),
    ]);
    await page.waitForTimeout(800);
    await expect(page.locator("#sess")).not.toHaveText("");
  });

  test("Calibrate saves POST calib routes", async ({ page }) => {
    const posts: string[] = [];
    await page.route("**/api/calib/**", async (route) => {
      posts.push(route.request().url());
      await route.continue();
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Calibrate" }).click();
    const dialogPromise = page.waitForEvent("dialog");
    await page.getByTestId("calib-zone-xmin").click();
    const dialog = await dialogPromise;
    await dialog.accept();
    expect(posts.some((p) => p.includes("/api/calib/zone_xmin"))).toBeTruthy();
  });

  test("Bring-up tab loads and complete endpoint", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Bring-up" }).click();
    await expect(page.getByRole("button", { name: "Finish bring-up" })).toBeVisible();
    const complete = page.waitForResponse((r) => r.url().includes("/api/bringup/complete") && r.ok());
    const dialogPromise = page.waitForEvent("dialog");
    await page.getByRole("button", { name: "Finish bring-up" }).click();
    const dialog = await dialogPromise;
    await dialog.accept();
    await complete;
  });

  test("Health tab loads checks", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Health" }).click();
    await expect(page.locator("#healthpre")).not.toHaveText("Loading…");
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.locator("#healthpre")).toContainText(/OK|CRITICAL|DEGRADED/);
  });

  test("Learning tab shows bandit JSON", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Learning" }).click();
    await expect(page.locator("#learnpre")).toContainText("enabled");
  });

  test("Camera and Log tabs render", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Camera" }).click();
    await expect(page.locator("#vis")).toBeVisible();
    await page.getByRole("button", { name: "Log" }).click();
    await expect(page.locator("#logpre")).toBeVisible();
  });
});
