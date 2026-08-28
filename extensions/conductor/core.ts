/**
 * Conductor -- config core for the lab's own MCP integration.
 *
 * Decides which MCP servers (and which of their tools) each role gets.
 * Pure functions over plain data; unit-tested with bun test. The pi wiring
 * lives in index.ts.
 *
 * Config files (merged in order, later wins on server-name collision):
 *   1. <harness>/mcp.json      -- harness-global layer (agent dir)
 *   2. <project>/.mcp.json     -- project layer (shared convention)
 *   3. <project>/.pi/mcp.json  -- project layer (pi convention)
 *
 * Shape (standard mcpServers, plus harness fields):
 *
 *   {
 *     "mcpServers": {
 *       "tavily": { "url": "https://mcp.tavily.com/mcp" },
 *       "zotero": {
 *         "command": "uvx",
 *         "args": ["--from", "zotero-mcp-server", "zotero-mcp"],
 *         "env": { "ZOTERO_LOCAL": "true", "KEY": "${ENV_VAR}" },
 *         // harness fields:
 *         "roles": ["librarian"],                       // array shorthand
 *         "roles": { "librarian": { "tools": [...] } }, // or per-role filters
 *         "tools": ["zotero_search_items"],             // server-wide allowlist
 *         "excludeTools": ["zotero_delete_item"],       // server-wide denylist
 *         "startupTimeoutMs": 60000
 *       }
 *     }
 *   }
 *
 * - `roles` absent: every role gets the server.
 * - `roles` array: only those roles get it (whole server).
 * - `roles` object: only the listed roles get it; each role value may carry
 *   its own { tools, excludeTools } applied after the server-wide filter.
 * - `${VAR}` in url/args/env/headers is expanded from process.env.
 * - Servers with `"auth": "oauth"` are skipped: OAuth is out of scope.
 */

export const HARNESS_CONFIG = "mcp.json";

export interface ToolFilter {
  tools?: string[];
  excludeTools?: string[];
}

export interface ServerConfig extends ToolFilter {
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  roles?: string[] | Record<string, ToolFilter>;
  startupTimeoutMs?: number;
  auth?: string;
}

export interface McpConfig {
  mcpServers?: Record<string, ServerConfig>;
}

export interface RoleServer {
  name: string;
  config: ServerConfig;
  /** Effective tool filter for this role (server-wide + per-role merged). */
  filter: ToolFilter;
  /** Remote (url) or local stdio (command). */
  kind: "remote" | "stdio";
}

/** Expand ${VAR} references from process.env. Unknown vars expand to "". */
export function expandEnv(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => env[name] ?? "");
}

function expandServer(config: ServerConfig, env: NodeJS.ProcessEnv): ServerConfig {
  return {
    ...config,
    url: config.url ? expandEnv(config.url, env) : undefined,
    headers: config.headers
      ? Object.fromEntries(Object.entries(config.headers).map(([k, v]) => [k, expandEnv(v, env)]))
      : undefined,
    args: config.args?.map((a) => expandEnv(a, env)),
    env: config.env
      ? Object.fromEntries(Object.entries(config.env).map(([k, v]) => [k, expandEnv(v, env)]))
      : undefined,
  };
}

/** Merge config layers; later layers override whole server entries by name. */
export function mergeConfigs(layers: McpConfig[]): McpConfig {
  const mcpServers: Record<string, ServerConfig> = {};
  for (const layer of layers) {
    for (const [name, config] of Object.entries(layer.mcpServers ?? {})) {
      mcpServers[name] = config;
    }
  }
  return { mcpServers };
}

/** Resolve the effective per-role view of a merged config. */
export function serversForRole(
  merged: McpConfig,
  role: string,
  env: NodeJS.ProcessEnv = process.env,
): RoleServer[] {
  const out: RoleServer[] = [];
  for (const [name, raw] of Object.entries(merged.mcpServers ?? {})) {
    const config = expandServer(raw, env);
    if (config.auth === "oauth") continue; // OAuth unsupported; surfaced by index.ts
    const kind = config.url ? "remote" : config.command ? "stdio" : undefined;
    if (!kind) continue; // neither url nor command: not a runnable server

    let roleFilter: ToolFilter = {};
    if (Array.isArray(config.roles)) {
      if (!config.roles.includes(role)) continue;
    } else if (config.roles && typeof config.roles === "object") {
      const perRole = config.roles[role];
      if (!perRole) continue;
      roleFilter = perRole;
    }

    // Server-wide filter first, per-role filter on top. An allowlist in
    // either layer narrows; denylists union.
    const tools = intersectAllowlists(config.tools, roleFilter.tools);
    const excludeTools = [
      ...new Set([...(config.excludeTools ?? []), ...(roleFilter.excludeTools ?? [])]),
    ];
    out.push({ name, config, kind, filter: { tools, excludeTools } });
  }
  return out;
}

function intersectAllowlists(a?: string[], b?: string[]): string[] | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.filter((t) => b.includes(t));
}

/** Apply the effective filter to a server's advertised tool names. */
export function filterToolNames(names: string[], filter: ToolFilter): string[] {
  let out = names;
  if (filter.tools) out = out.filter((n) => filter.tools!.includes(n));
  if (filter.excludeTools?.length) out = out.filter((n) => !filter.excludeTools!.includes(n));
  return out;
}

/** Sanitize a server/tool name component for use in pi tool names. */
export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
}

/** pi tool name for an MCP tool: mcp__<server>__<tool>. */
export function toolName(server: string, tool: string): string {
  return `mcp__${sanitizeName(server)}__${sanitizeName(tool)}`.slice(0, 64);
}

/** Parse and validate a config file's JSON. Throws on malformed JSON. */
export function parseConfig(text: string, path: string): McpConfig {
  const value = JSON.parse(text) as McpConfig;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path}: expected a JSON object with an "mcpServers" key`);
  }
  return value;
}
