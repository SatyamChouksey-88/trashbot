import { describe, expect, it } from "vitest";
import { statusSchema } from "../src/contract.js";

describe("mock contract", () => {
  it("parses mock status shape", () => {
    const s = statusSchema.parse({
      fw: "0.1.0-mock",
      mode: "idle",
      state: "IDLE",
      distance_cm: 42,
    });
    expect(s.mode).toBe("idle");
  });
});

describe("jpeg magic", () => {
  it("placeholder is valid jpeg", async () => {
    const { PLACEHOLDER_JPEG_B64 } = await import("../mock-robot/placeholder.js");
    const buf = Buffer.from(PLACEHOLDER_JPEG_B64, "base64");
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
  });
});
