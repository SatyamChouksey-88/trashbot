import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RobotClient } from "./robotClient.js";
import { CLEAN_ROOM_PROMPT } from "./prompts/cleanRoom.js";

const client = new RobotClient();
const server = new McpServer({ name: "trashbot", version: "0.1.0" });

server.tool("get_status", "Read robot status", {}, async () => {
  const s = await client.getStatus();
  return {
    content: [{ type: "text", text: `mode=${s.mode} state=${s.state}\n${JSON.stringify(s, null, 2)}` }],
  };
});

server.tool("take_photo", "Capture a JPEG from the robot camera", {}, async () => {
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
  "start_cleaning",
  "Start an autonomous cleaning session",
  {
    max_items: z.number().min(1).max(20).default(5),
    max_time_s: z.number().min(10).max(600).default(180),
    label: z.string().optional(),
  },
  async ({ max_items, max_time_s, label }) => {
    await client.postJson("/api/clean", { max_items, max_time_s, label });
    return { content: [{ type: "text", text: "Cleaning started." }] };
  },
);

server.tool("stop", "Stop the robot and return to idle", {}, async () => {
  await client.stop();
  return { content: [{ type: "text", text: "Stop sent." }] };
});

server.tool(
  "set_mode",
  "Set idle or manual mode",
  { mode: z.enum(["idle", "manual"]) },
  async ({ mode }) => {
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
  "Drive a set distance in cm (manual)",
  { distance_cm: z.number().min(-100).max(100), speed: z.number().min(10).max(80).default(40) },
  async ({ distance_cm, speed }) => {
    const r = await client.move(distance_cm, speed);
    return { content: [{ type: "text", text: JSON.stringify(r) }] };
  },
);

server.tool(
  "turn",
  "Turn in place by degrees (manual)",
  { degrees: z.number().min(-180).max(180), speed: z.number().min(10).max(80).default(40) },
  async ({ degrees, speed }) => {
    const r = await client.turn(degrees, speed);
    return { content: [{ type: "text", text: JSON.stringify(r) }] };
  },
);

server.tool(
  "scoop",
  "Move the dustpan arm",
  { action: z.enum(["down", "carry", "tip", "cycle"]) },
  async ({ action }) => {
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
  console.error("TrashBot MCP server running");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
