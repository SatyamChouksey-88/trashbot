import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Lesson = {
  id: string;
  created: string;
  last_seen: string;
  count: number;
  mistake: string;
  correction: string;
  evidence: {
    mission_id?: string;
    photo_path?: string;
    user_confirmed: boolean;
  };
};

const agentRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const memoryDir = path.join(agentRoot, "memory");
const lessonsPath = path.join(memoryDir, "lessons.json");

function ensureDir() {
  if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
}

export function readLessons(): Lesson[] {
  ensureDir();
  if (!fs.existsSync(lessonsPath)) return [];
  try {
    const raw = fs.readFileSync(lessonsPath, "utf8");
    const parsed = JSON.parse(raw) as { lessons?: Lesson[] };
    return parsed.lessons ?? [];
  } catch {
    return [];
  }
}

function writeLessons(lessons: Lesson[]) {
  ensureDir();
  fs.writeFileSync(lessonsPath, JSON.stringify({ lessons }, null, 2), "utf8");
}

export function confirmedLessons(): Lesson[] {
  return readLessons().filter((l) => l.evidence.user_confirmed);
}

export function recordLesson(input: {
  mistake: string;
  correction: string;
  mission_id?: string;
  user_confirmed?: boolean;
}): Lesson {
  const lessons = readLessons();
  const now = new Date().toISOString();
  const existing = lessons.find(
    (l) => l.mistake === input.mistake && l.correction === input.correction,
  );
  if (existing) {
    existing.count += 1;
    existing.last_seen = now;
    if (input.mission_id) existing.evidence.mission_id = input.mission_id;
    if (input.user_confirmed) existing.evidence.user_confirmed = true;
    writeLessons(lessons);
    return existing;
  }
  const lesson: Lesson = {
    id: `L-${Date.now()}`,
    created: now,
    last_seen: now,
    count: 1,
    mistake: input.mistake,
    correction: input.correction,
    evidence: {
      mission_id: input.mission_id,
      user_confirmed: input.user_confirmed ?? false,
    },
  };
  lessons.push(lesson);
  writeLessons(lessons);
  return lesson;
}

export function recordUserCorrection(note: string, mission_id?: string): Lesson {
  return recordLesson({
    mistake: note,
    correction: "User correction: do not treat as trash",
    mission_id,
    user_confirmed: true,
  });
}
