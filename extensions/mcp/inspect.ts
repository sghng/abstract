/**
 * mcp inspect -- dev utility: dump every tool every configured MCP server
 * exposes, as JSON, for curating mcp.json.
 *
 * Usage:
 *   bun extensions/mcp/inspect.ts [--role <role>] [cwd]
 *
 * Without --role, connects to ALL servers regardless of `roles` scoping
 * (the full menu, server-wide filters still applied). With --role, shows
 * exactly what that role would get, with resolved aliases.
 * Output: JSON array of { server, name, description, inputSchema } on
 * stdout; connection errors on stderr. Pipe to a file, pick what you want,
 * rewrite names/descriptions, and paste into mcp.json `tools` maps.
 */
import { connectServer } from "./client.ts";
import { allServers, mergeConfigs, planTools, serversForRole, toolName } from "./core.ts";
import { loadConfigLayers } from "./index.ts";

const args = process.argv.slice(2);
let role: string | undefined;
let cwd = process.cwd();
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--role") role = args[++i];
  else cwd = args[i];
}

const { layers, errors } = loadConfigLayers(cwd);
for (const e of errors) console.error(`config: ${e}`);
const merged = mergeConfigs(layers);
const servers = role ? serversForRole(merged, role) : allServers(merged);

const results = await Promise.allSettled(servers.map((s) => connectServer(s, "abstract-inspect")));
const out: unknown[] = [];
for (let i = 0; i < results.length; i++) {
  const result = results[i];
  const server = servers[i];
  if (result.status === "rejected") {
    console.error(`${server.name}: ${result.reason instanceof Error ? result.reason.message : result.reason}`);
    continue;
  }
  const { client, tools } = result.value;
  const byOrig = new Map(tools.map((t) => [t.name, t]));
  for (const plan of planTools(tools.map((t) => t.name), server.filters)) {
    const advertised = byOrig.get(plan.orig)!;
    out.push({
      server: server.name,
      name: toolName(server.name, plan.alias),
      calls: plan.orig,
      description: plan.description ?? advertised.description,
      inputSchema: advertised.inputSchema,
    });
  }
  await client.close().catch(() => {});
}

console.log(JSON.stringify(out, null, 2));
