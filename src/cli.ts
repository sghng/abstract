#!/usr/bin/env bun
/**
 * abstract init <dir>: scaffold a research project for the skills setup.
 *
 * Writes <dir>/opencode.jsonc from the repo template (paths resolved to this
 * clone), symlinks the sidekick briefs into <dir>/.opencode/agents/, and
 * scaffolds the notes skeleton. Never overwrites an existing config.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [cmd, dir] = process.argv.slice(2);

if (cmd !== "init" || !dir) {
  console.log("usage: abstract init <dir>");
  process.exit(cmd ? 1 : 0);
}

const target = path.resolve(dir);
mkdirSync(target, { recursive: true });

// 1. config from the template, paths resolved to this clone
const cfgPath = path.join(target, "opencode.jsonc");
if (existsSync(cfgPath)) {
  console.error(`${cfgPath} exists; refusing to overwrite`);
  process.exit(1);
}
const tpl = readFileSync(path.join(ROOT, "opencode.template.jsonc"), "utf8");
writeFileSync(cfgPath, tpl.replaceAll("~/dev/abstract", ROOT));

// 2. sidekick briefs as symlinks under .opencode/agents/
const agentsDir = path.join(target, ".opencode", "agents");
mkdirSync(agentsDir, { recursive: true });
let linked = 0;
for (const f of readdirSync(path.join(ROOT, "agents")).filter((f: string) => f.endsWith(".md"))) {
  const link = path.join(agentsDir, f);
  if (!existsSync(link)) {
    symlinkSync(path.join(ROOT, "agents", f), link);
    linked++;
  }
}

// 3. the project skeleton (dirs only; never overwrite)
for (const d of [
  "notes/tickets",
  "notes/reports",
  "notes/memos",
  "notes/dev",
  "draft",
  "experiments",
  "model",
  "references",
])
  mkdirSync(path.join(target, d), { recursive: true });
const indexPath = path.join(target, "notes", "index.md");
if (!existsSync(indexPath))
  writeFileSync(
    indexPath,
    "# Notes\n\nOne line per standing note, wiki-linked, grouped by kind (story, tickets, reports, memos, literature).\n",
  );

console.log(`initialized ${target}`);
console.log(`  config: ${cfgPath}`);
console.log(`  agents: ${agentsDir} (${linked} symlinks into ${ROOT}/agents)`);
console.log("next: open the project in opencode; the kernel and skills mount from the config.");
