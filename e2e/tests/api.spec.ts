import { test, expect } from "@playwright/test";

test("API contract against mock", async ({ request }) => {
  const status = await request.get("/api/status");
  expect(status.ok()).toBeTruthy();
  const st = await status.json();
  expect(st.fw).toBeTruthy();
  expect(st.mode).toBeTruthy();

  const photo = await request.get("/api/photo");
  const buf = await photo.body();
  expect(buf[0]).toBe(0xff);
  expect(buf[1]).toBe(0xd8);

  await request.post("/api/mode", { data: { mode: "manual" } });
  await request.post("/api/drive", { data: { left: 10, right: 10, duration_ms: 200 } });
  await request.post("/api/stop");

  const log = await request.get("/api/log?since=0");
  const lg = await log.json();
  expect(Array.isArray(lg.events)).toBeTruthy();
});
