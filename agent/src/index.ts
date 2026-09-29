import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RobotClient } from "./robotClient.js";
import { CLEAN_ROOM_PROMPT } from "./prompts/cleanRoom.js";
import { guardTool } from "./toolGuard.js";
import { confirmedLessons, readLessons, recordLesson, recordUserCorrection } from "./lessons.js";
import { createExecutor } from "./bolo.js";
import { makeHttp } from "./boloHttp.js";

const client = new RobotClient();
const executor = createExecutor({
  http: makeHttp(process.env.TRASHBOT_URL ?? "http://trashbot.local", process.env.TRASHBOT_TOKEN),
  mode: (["read_only", "dry_run", "full"].includes((process.env.TRASHBOT_MODE ?? "dry_run").toLowerCase())
    ? (process.env.TRASHBOT_MODE ?? "dry_run").toLowerCase()
    : "dry_run") as "read_only" | "dry_run" | "full",
  lang: (["auto", "en", "hi"].includes((process.env.TRASHBOT_LANG ?? "auto").toLowerCase())
    ? (process.env.TRASHBOT_LANG ?? "auto").toLowerCase()
    : "auto") as "auto" | "en" | "hi",
});
const server = new McpServer({ name: "trashbot", version: "0.1.0" });

function runCommandContent(r: Awaited<ReturnType<typeof executor.run>>) {
  const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
    { type: "text", text: r.text },
  ];
  for (const img of r.images) {
    content.push({ type: "image", data: img.data, mimeType: img.mimeType });
  }
  content.push({
    type: "text",
    text: JSON.stringify({
      ok: r.ok,
      kind: r.kind,
      mode: r.mode,
      needsAnswer: r.needsAnswer,
      aliasOffer: r.aliasOffer,
      calls: r.calls,
    }),
  });
  return { content, isError: false as const };
}

function guard(name: string) {
  const g = guardTool(name);
  if (g.blocked) return { content: [{ type: "text" as const, text: g.blocked }] };
  if (g.dryRun) return { content: [{ type: "text" as const, text: g.dryRun }] };
  return null;
}

server.tool("get_status", "Read robot status. 'kya haal hai', 'status batao', 'kya chal raha hai'.", {}, async () => {
  const s = await client.getStatus();
  return {
    content: [{ type: "text", text: `mode=${s.mode} state=${s.state}\n${JSON.stringify(s, null, 2)}` }],
  };
});

server.tool("get_health", "Read robot health checks. 'tabiyat kaisi hai', 'koi dikkat hai'.", {}, async () => {
  try {
    const h = await client.getJson("/api/health");
    return { content: [{ type: "text", text: JSON.stringify(h, null, 2) }] };
  } catch {
    return { content: [{ type: "text", text: "Health endpoint not available on this firmware build yet." }] };
  }
});

server.tool("get_mission", "Read current mission summary", {}, async () => {
  try {
    const m = await client.getJson("/api/mission/current");
    return { content: [{ type: "text", text: JSON.stringify(m, null, 2) }] };
  } catch {
    return { content: [{ type: "text", text: "Mission API not available on this firmware build yet." }] };
  }
});

server.tool("take_photo", "Capture a JPEG from the robot camera. 'photo lo', 'kya dikh raha hai', 'what do you see'.", {}, async () => {
  const buf = await client.getPhoto();
  const s = await client.getStatus();
  return {
    content: [
      { type: "text", text: `Detections: ${JSON.stringify(s.detections ?? [])}` },
      { type: "image", data: buf.toString("base64"), mimeType: "image/jpeg" },
    ],
  };
});

server.tool(
  "plan_cleaning",
  "Photo + detections + lessons; no motion (use before full mode)",
  { max_items: z.number().min(1).max(20).default(5) },
  async ({ max_items }) => {
    const s = await client.getStatus();
    const buf = await client.getPhoto();
    const lessons = confirmedLessons();
    const dets = (s.detections ?? []) as Array<{ score?: number; x?: number; y?: number }>;
    const zones = dets.map((d) => {
      const score = d.score ?? 0;
      const zone = score >= 0.75 ? "CONFIDENT" : score >= 0.5 ? "UNCERTAIN" : "IGNORE";
      return { ...d, zone };
    });
    const lessonText =
      lessons.length === 0
        ? "No confirmed lessons yet."
        : lessons.map((l) => `- ${l.correction} (${l.mistake})`).join("\n");
    return {
      content: [
        {
          type: "text",
          text:
            `Plan (robot will NOT move): classify TRASH vs KEEP vs UNKNOWN. ` +
            `UNCERTAIN detections may be skipped on-robot unless you confirm in full mode.\n` +
            `Collect up to ${max_items} trash items after TRASHBOT_MODE=full.\n` +
            `Confirmed lessons:\n${lessonText}\n` +
            `Detections+zones: ${JSON.stringify(zones, null, 2)}\n` +
            `Status: ${JSON.stringify(s, null, 2)}`,
        },
        { type: "image", data: buf.toString("base64"), mimeType: "image/jpeg" },
      ],
    };
  },
);

server.tool("get_lessons", "Read agent lesson memory (confirmed + pending)", {}, async () => {
  const lessons = readLessons();
  return { content: [{ type: "text", text: JSON.stringify(lessons, null, 2) }] };
});

server.tool(
  "record_lesson",
  "Store a lesson from a mission review (set user_confirmed when the user agreed)",
  {
    mistake: z.string().min(3),
    correction: z.string().min(3),
    mission_id: z.string().optional(),
    user_confirmed: z.boolean().default(false),
  },
  async ({ mistake, correction, mission_id, user_confirmed }) => {
    const lesson = recordLesson({ mistake, correction, mission_id, user_confirmed });
    return { content: [{ type: "text", text: JSON.stringify(lesson, null, 2) }] };
  },
);

server.tool(
  "record_user_correction",
  "Record a user correction (always confirmed)",
  { note: z.string().min(3), mission_id: z.string().optional() },
  async ({ note, mission_id }) => {
    const lesson = recordUserCorrection(note, mission_id);
    return { content: [{ type: "text", text: JSON.stringify(lesson, null, 2) }] };
  },
);

server.tool(
  "start_cleaning",
  "Start an autonomous cleaning session. User may say 'kachra saaf karo', 'safai shuru karo', 'kachra uthao', 'jhadu lagao', 'clean the room'. Prefer run_command.",
  {
    max_items: z.number().min(1).max(20).default(5),
    max_time_s: z.number().min(10).max(600).default(180),
    label: z.string().optional(),
  },
  async ({ max_items, max_time_s, label }) => {
    const g = guard("start_cleaning");
    if (g) return g;
    await client.postJson("/api/clean", { max_items, max_time_s, label });
    return { content: [{ type: "text", text: "Cleaning started." }] };
  },
);

server.tool(
  "run_command",
  "Run a TrashBot command written in plain Hinglish, English or Hindi (Devanagari) — e.g. 'kachra saaf karo', '20 cm aage chalo', '90 degree left ghumo', 'photo lo', 'battery kitni hai', 'ruko', 'clean the room', 'turn left 90 then forward 20 cm'. ALWAYS try this first with the user's exact words. It applies the robot's safety rules (stop words win, 'mat/nahi/don't' never moves, typos only suggest, unclear commands ask), respects TRASHBOT_MODE (read_only / dry_run / full) and returns a reply already in the user's language. If the result says needsAnswer, show the question and options to the user and call run_command again with their answer ('haan', 'nahi', '1', '2').",
  { text: z.string().min(1).max(300) },
  async ({ text }) => runCommandContent(await executor.run(text)),
);

server.tool(
  "add_alias",
  "Only after the user said yes to remembering this phrase.",
  { phrase: z.string().min(1).max(40), command_text: z.string().optional() },
  async ({ phrase, command_text }) => {
    const r = await executor.addAlias(phrase, command_text);
    return { content: [{ type: "text", text: JSON.stringify(r) }] };
  },
);

server.tool("list_aliases", "List learned phrase aliases on the robot", {}, async () => {
  const list = await executor.listAliases();
  return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
});

server.tool("remove_alias", "Remove a learned phrase", { phrase: z.string().min(1) }, async ({ phrase }) => {
  const r = await executor.removeAlias(phrase);
  return { content: [{ type: "text", text: JSON.stringify(r) }] };
});

server.tool(
  "stop",
  "Call this FIRST, before anything else, whenever the user says stop / ruko / ruk jao / bas / band karo / wait / hold on / रुको — any language or spelling. Works in every mode.",
  {},
  async () => {
    await client.stop();
    return { content: [{ type: "text", text: "Stop sent." }] };
  },
);

server.tool(
  "estop",
  "Use for emergency / bachao / e-stop / danger. Only a human can reset it, from the phone app.",
  {},
  async () => {
    await client.postJson("/api/estop", {});
    return { content: [{ type: "text", text: "ESTOP sent." }] };
  },
);

server.tool(
  "set_mode",
  "Set idle or manual mode",
  { mode: z.enum(["idle", "manual"]) },
  async ({ mode }) => {
    const g = guard("set_mode");
    if (g) return g;
    await client.setMode(mode);
    return { content: [{ type: "text", text: `Mode set to ${mode}.` }] };
  },
);

server.tool(
  "drive",
  "Small manual nudges only; prefer start_cleaning; forward blocked near obstacles",
  {
    direction: z.enum(["forward", "back", "left", "right"]),
    speed: z.number().min(10).max(80).default(40),
    duration_ms: z.number().min(100).max(1000).default(500),
  },
  async ({ direction, speed, duration_ms }) => {
    const g = guard("drive");
    if (g) return g;
    await client.drive(direction, speed, duration_ms);
    return { content: [{ type: "text", text: `Drive ${direction} sent.` }] };
  },
);

server.tool(
  "get_events",
  "Read recent robot event log",
  { limit: z.number().min(1).max(100).default(20), since: z.number().optional() },
  async ({ limit, since }) => {
    const log = await client.getLog(since ?? 0);
    const list = log.events.slice(-limit);
    const text = list.map((e) => `${e.seq} ${e.type} a=${e.a ?? 0} b=${e.b ?? 0}`).join("\n");
    return { content: [{ type: "text", text: `${text}\nlast_seq=${log.last_seq}` }] };
  },
);

server.tool(
  "move",
  "Drive a set distance in cm (manual). Rear limit 20 cm (no rear sensor).",
  { distance_cm: z.number().min(-20).max(50), speed: z.number().min(10).max(80).default(40) },
  async ({ distance_cm, speed }) => {
    const g = guard("move");
    if (g) return g;
    const r = await client.move(distance_cm, speed);
    return { content: [{ type: "text", text: JSON.stringify(r) }] };
  },
);

server.tool(
  "turn",
  "Turn in place. Always pass direction.",
  {
    degrees: z.number().min(1).max(180),
    direction: z.enum(["left", "right"]),
    speed: z.number().min(10).max(80).default(40),
  },
  async ({ degrees, direction, speed }) => {
    const g = guard("turn");
    if (g) return g;
    const s = await client.getStatus();
    const sign = (s as { turn_left_sign?: number }).turn_left_sign === -1 ? -1 : 1;
    const deg = direction === "left" ? degrees * sign : -degrees * sign;
    const r = await client.turn(deg, speed);
    return { content: [{ type: "text", text: JSON.stringify(r) }] };
  },
);

server.tool(
  "scoop",
  "Move the dustpan arm",
  { action: z.enum(["down", "carry", "tip", "cycle"]) },
  async ({ action }) => {
    const g = guard("scoop");
    if (g) return g;
    await client.scoop(action);
    return { content: [{ type: "text", text: `Scoop ${action} sent.` }] };
  },
);

server.prompt("clean_room", "Clean a room with TrashBot safely", async () => ({
  messages: [{ role: "user", content: { type: "text", text: CLEAN_ROOM_PROMPT } }],
}));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`TrashBot MCP server (TRASHBOT_MODE=${process.env.TRASHBOT_MODE ?? "dry_run"})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
