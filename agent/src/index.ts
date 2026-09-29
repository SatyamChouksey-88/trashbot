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

server.tool(
  "take_photo",
  "Capture a JPEG from the robot camera",
  {},
  async () => {
    const buf = await client.getPhoto();
    return {
      content: [
        { type: "text", text: "Latest frame from TrashBot." },
        { type: "image", data: buf.toString("base64"), mimeType: "image/jpeg" },
      ],
    };
  },
);

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
