// Smoke test for extensions/mcp: fake pi host, real MCP servers.
// Usage: HARNESS_ROLE=<role> bun extensions/mcp/smoke.ts [cwd]
const cwd = process.argv[2] ?? "/tmp/mcp-smoke";
import { mkdirSync } from "node:fs";
mkdirSync(cwd, { recursive: true });

const tools: string[] = [];
const handlers: Record<string, (e: unknown, ctx: unknown) => Promise<void>> = {};
const statuses: Record<string, string | undefined> = {};
const notices: string[] = [];

const pi = {
  registerTool(def: { name: string }) {
    tools.push(def.name);
  },
  on(event: string, fn: (e: unknown, ctx: unknown) => Promise<void>) {
    handlers[event] = fn;
  },
};

const mod = await import("./index.ts");
mod.default(pi as never);

const ctx = {
  cwd,
  ui: {
    setStatus: (k: string, v: string | undefined) => {
      statuses[k] = v;
    },
    notify: (msg: string, type?: string) => {
      notices.push(`${type ?? "info"}: ${msg}`);
    },
  },
};

console.log(`role=${process.env.HARNESS_ROLE} connecting...`);
const t0 = Date.now();
await handlers["session_start"]?.({}, ctx);
console.log(`connected in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log("status:", statuses["mcp"]);
for (const n of notices) console.log("notify:", n);
console.log(`tools (${tools.length}):`);
for (const t of tools.sort()) console.log(" ", t);
await handlers["session_shutdown"]?.({}, ctx);
process.exit(0);
