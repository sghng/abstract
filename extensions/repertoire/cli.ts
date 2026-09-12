/**
 * CLI wrapper around repertoireTool for dev sessions (no HARNESS_ROLE needed).
 *
 * Usage:
 *   bun extensions/repertoire/cli.ts search  --text "..." [--journal psychometrika] [--section methods] [--prefer results] [--year 2023] [--doi 10.1017/psy.2024.18] [--topK 6] [--maxPerPaper 1]
 *   bun extensions/repertoire/cli.ts context --ref 10.1017:psy.2024.18#c046 [--radius 2]
 *   bun extensions/repertoire/cli.ts outline --doi 10.1017/psy.2024.18
 */

import { repertoireTool } from "./index.ts";

const args = process.argv.slice(2);
const action = args.shift() as "search" | "context" | "outline" | undefined;
if (!action || !["search", "context", "outline"].includes(action)) {
  console.error("usage: cli.ts <search|context|outline> [--key value ...]");
  process.exit(1);
}

const params: Record<string, unknown> = { action };
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, "");
  const raw = args[i + 1];
  const num = Number(raw);
  params[key] = raw !== "" && !Number.isNaN(num) && ["topK", "maxPerPaper", "radius", "year"].includes(key) ? num : raw;
}

const result = await repertoireTool.execute("cli", params as any);
console.log(result.content.map((c: any) => c.text).join("\n"));
