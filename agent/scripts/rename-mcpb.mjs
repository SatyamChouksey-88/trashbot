import { rename, readdir } from "node:fs/promises";
import { join } from "node:path";

const dir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const files = await readdir(dir);
const built = files.find((f) => f.endsWith(".mcpb") && f !== "trashbot.mcpb");
if (built) {
  await rename(join(dir, built), join(dir, "trashbot.mcpb"));
  console.error(`Renamed ${built} → trashbot.mcpb`);
}
