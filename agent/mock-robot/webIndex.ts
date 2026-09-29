import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "firmware", "lib", "net", "web_index.h");

export function loadWebIndex(): string {
  const raw = readFileSync(root, "utf8");
  const m = /R"HTML\(([\s\S]*)\)HTML"/.exec(raw);
  if (!m) throw new Error("web_index.h format unexpected");
  return m[1];
}
