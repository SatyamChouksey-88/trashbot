import { describe, expect, it } from "vitest";
import { CLEAN_ROOM_PROMPT } from "../src/prompts/cleanRoom.js";

describe("clean_room prompt", () => {
  it("includes safety rules", () => {
    expect(CLEAN_ROOM_PROMPT).toContain("get_status");
    expect(CLEAN_ROOM_PROMPT).toContain("keep");
  });
});
