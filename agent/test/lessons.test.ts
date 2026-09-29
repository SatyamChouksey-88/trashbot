import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { confirmedLessons, readLessons, recordLesson } from "../src/lessons.js";

const agentRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lessonsPath = path.join(agentRoot, "memory", "lessons.json");

afterEach(() => {
  if (fs.existsSync(lessonsPath)) fs.unlinkSync(lessonsPath);
});

describe("lessons memory", () => {
  it("starts empty", () => {
    expect(readLessons()).toEqual([]);
  });

  it("records and confirms lessons", () => {
    recordLesson({
      mistake: "treated pen as trash",
      correction: "leave pens",
      user_confirmed: true,
    });
    expect(confirmedLessons().length).toBe(1);
    recordLesson({
      mistake: "treated pen as trash",
      correction: "leave pens",
      user_confirmed: true,
    });
    expect(readLessons()[0].count).toBe(2);
  });
});
