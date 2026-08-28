/**
 * mcp inspect -- dev utility: dump the final tool surface (after each
 * server's `map` shaping) as JSON. Usage:
 *
 *   bun extensions/mcp/inspect.ts [--role <role>]
 *
 * Without --role, connects to every server in servers.ts; with --role,
 * shows exactly what that role would get.
 */
import { connectServer } from "./client.ts";
import { SERVERS } from "./servers.ts";

const args = process.argv.slice(2);
let role: string | undefined;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--role") role = args[++i];
}

const servers = role
  ? SERVERS.filter((s) => s.roles === "all" || s.roles.includes(role))
  : SERVERS;

const env = { ...process.env };
const results = await Promise.allSettled(
  servers.map((s) => connectServer(s, "abstract-inspect", env)),
);
const out: unknown[] = [];
for (let i = 0; i < results.length; i++) {
  const result = results[i];
  const server = servers[i];
  if (result.status === "rejected") {
    console.error(`${server.name}: ${result.reason instanceof Error ? result.reason.message : result.reason}`);
    continue;
  }
  const { client, tools } = result.value;
  for (const tool of server.map ? server.map(tools) : tools) {
    out.push({
      server: server.name,
      name: tool.name,
      calls: tool.calls,
      description: tool.description,
      inputSchema: tool.inputSchema,
    });
  }
  await client.close().catch(() => {});
}
console.log(JSON.stringify(out, null, 2));
