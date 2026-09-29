#!/usr/bin/env node
// Heavier fuzz run, cross-platform (Windows cmd / PowerShell / bash): node tools/fuzz.mjs [cases] [seeds]
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const n = process.argv[2] || '50000';
const seeds = Number(process.argv[3] || 3);
let failed = false;
for (let s = 0; s < seeds; s++) {
  console.log(`fuzz: ${n} cases per property, seed ${s}`);
  const r = spawnSync(process.execPath, ['--test', 'test/properties.test.mjs'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, TB_FUZZ_N: n, TB_FUZZ_SEED: String(s) },
  });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
