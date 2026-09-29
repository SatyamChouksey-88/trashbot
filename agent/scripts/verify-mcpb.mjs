import { spawn } from "node:child_process";
import { mkdtemp, access, cp, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const agentRoot = join(__dirname, "..");
const mcpbPath = join(agentRoot, "trashbot.mcpb");

async function unpackMcpb(dest) {
  const zipCopy = join(dest, "pack.zip");
  await cp(mcpbPath, zipCopy);
  if (process.platform === "win32") {
    await execFileAsync(
      "powershell",
      ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zipCopy}' -DestinationPath '${dest}' -Force`],
      { cwd: agentRoot },
    );
  } else {
    await execFileAsync("unzip", ["-q", zipCopy, "-d", dest], { cwd: agentRoot });
  }
}

async function withMock(fn) {
  const mock = spawn(process.execPath, ["./node_modules/tsx/dist/cli.mjs", "mock-robot/server.ts"], {
    cwd: agentRoot,
    env: { ...process.env, MOCK_PORT: "8787" },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 900));
  try {
    await fn();
  } finally {
    mock.kill();
  }
}

async function mcpSmoke(entryJs) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entryJs],
    env: { ...process.env, TRASHBOT_URL: "http://127.0.0.1:8787", TRASHBOT_MODE: "read_only" },
    cwd: dirname(entryJs),
  });
  const client = new Client({ name: "verify-mcpb", version: "1.0" }, { capabilities: {} });
  await client.connect(transport);
  const { tools } = await client.listTools();
  if (!tools?.some((t) => t.name === "run_command")) throw new Error("run_command tool missing");
  const run = await client.callTool({ name: "run_command", arguments: { text: "ruko" } });
  const text = run.content?.find((c) => c.type === "text")?.text ?? "";
  if (!text) throw new Error("run_command returned empty");
  await client.close();
  return tools.length;
}

async function main() {
  await access(mcpbPath);
  const unpackDir = await mkdtemp(join(tmpdir(), "trashbot-mcpb-"));
  await unpackMcpb(unpackDir);
  const bundled = join(unpackDir, "dist", "index.js");
  await access(bundled);

  await withMock(async () => {
    const nWorkspace = await mcpSmoke(join(agentRoot, "dist", "index.js"));
    const nPacked = await mcpSmoke(bundled);
    console.error(`verify:mcpb OK (workspace ${nWorkspace} tools, packed ${nPacked} tools)`);
  });

  await rm(unpackDir, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
