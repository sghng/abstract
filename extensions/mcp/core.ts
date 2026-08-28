/**
 * mcp -- config core for the lab's own MCP integration.
 *
 * Decides which MCP servers (and which of their tools, under which names)
 * each role gets. Pure functions over plain data; unit-tested with bun
 * test. The pi wiring lives in index.ts.
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
 *       "tavily": {
 *         "url": "https://mcp.tavily.com/mcp/?tavilyApiKey=${TAVILY_API_KEY}",
 *         "tools": {                                    // curated exposure:
 *           "tavily_search": {                          //   orig name ->
 *             "name": "search",                         //   exposed alias
 *             "description": "Search the web for ..."   //   own description
 *           }
 *         }
 *       },
 *       "zotero": {
 *         "command": "uvx",
 *         "args": ["--from", "zotero-mcp-server", "zotero-mcp"],
 *         "env": { "ZOTERO_API_KEY": "${ZOTERO_API_KEY}" },
 *         // harness fields:
 *         "roles": ["librarian"],                       // array shorthand
 *         "roles": { "librarian": { "tools": [...] } }, // or per-role filters
 *         "tools": ["zotero_search_items"],             // allowlist form
 *         "excludeTools": ["zotero_delete_item"],       // denylist
 *         "startupTimeoutMs": 120000
 *       }
 *     }
 *   }
 *
 * - `roles` absent: every role gets the server.
 * - `roles` array: only those roles get it (whole server).
 * - `roles` object: only the listed roles get it; each role value may carry
 *   its own { tools, excludeTools } applied after the server-wide filter.
 * - `tools` array: allowlist, original names exposed as-is.
 * - `tools` object: allowlist with curation -- the exposed tool is
 *   mcp__<server>__<alias> carrying our own description, so the lab
 *   controls exactly what the model reads.
 * - `${VAR}` in url/args/env/headers is expanded from process.env.
 * - Servers with `"auth": "oauth"` are skipped: OAuth is out of scope.
 */

export const HARNESS_CONFIG = "mcp.json";

/** Per-tool curation: rename and/or redescribe what the model sees. */
export interface ToolExposure {
  name?: string;
  description?: string;
}

export interface ToolFilter {
  tools?: string[] | Record<string, ToolExposure>;
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
  /** Ordered filter layers: server-wide first, per-role second. */
  filters: ToolFilter[];
  /** Remote (url) or local stdio (command). */
  kind: "remote" | "stdio";
}

/** A tool to expose: call `orig` on the server, present `alias` to pi. */
export interface PlannedTool {
  orig: string;
  alias: string;
  description?: string;
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

function toRoleServer(name: string, config: ServerConfig, filters: ToolFilter[]): RoleServer | undefined {
  if (config.auth === "oauth") return undefined; // OAuth unsupported; surfaced by index.ts
  const kind = config.url ? "remote" : config.command ? "stdio" : undefined;
  if (!kind) return undefined; // neither url nor command: not a runnable server
  return { name, config, kind, filters };
}

/** Every runnable server in the merged config, ignoring `roles` scoping
 * (server-wide filters still apply). Used by dev utilities. */
export function allServers(merged: McpConfig, env: NodeJS.ProcessEnv = process.env): RoleServer[] {
  const out: RoleServer[] = [];
  for (const [name, raw] of Object.entries(merged.mcpServers ?? {})) {
    const config = expandServer(raw, env);
    const server = toRoleServer(name, config, [
      { tools: config.tools, excludeTools: config.excludeTools },
    ]);
    if (server) out.push(server);
  }
  return out;
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

    let roleFilter: ToolFilter = {};
    if (Array.isArray(config.roles)) {
      if (!config.roles.includes(role)) continue;
    } else if (config.roles && typeof config.roles === "object") {
      const perRole = config.roles[role];
      if (!perRole) continue;
      roleFilter = perRole;
    }

    const server = toRoleServer(name, config, [
      { tools: config.tools, excludeTools: config.excludeTools },
      roleFilter,
    ]);
    if (server) out.push(server);
  }
  return out;
}

/**
 * Apply one filter layer to planned tools. Array allowlist narrows by
 * original name; object allowlist narrows and curates (alias/description
 * from the object win over earlier layers). Denylist matches original names.
 */
function applyFilter(planned: PlannedTool[], filter: ToolFilter): PlannedTool[] {
  let out = planned;
  const tools = filter.tools;
  if (Array.isArray(tools)) {
    out = out.filter((t) => tools.includes(t.orig));
  } else if (tools && typeof tools === "object") {
    const exposures: Record<string, ToolExposure> = tools;
    out = out.flatMap((t) => {
      const exposure = exposures[t.orig];
      return exposure === undefined ? [] : [{ ...t, ...pickDefined(exposure) }];
    });
  }
  if (filter.excludeTools?.length) {
    out = out.filter((t) => !filter.excludeTools!.includes(t.orig));
  }
  return out;
}

function pickDefined(exposure: ToolExposure): Partial<PlannedTool> {
  const out: Partial<PlannedTool> = {};
  if (exposure.name !== undefined) out.alias = exposure.name;
  if (exposure.description !== undefined) out.description = exposure.description;
  return out;
}

/** Resolve a server's advertised tool names through the filter layers. */
export function planTools(names: string[], filters: ToolFilter[]): PlannedTool[] {
  let planned: PlannedTool[] = names.map((orig) => ({ orig, alias: orig }));
  for (const filter of filters) {
    planned = applyFilter(planned, filter);
  }
  return planned;
}

/** Sanitize a server/tool name component for use in pi tool names. */
export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
}

/** pi tool name for an MCP tool: mcp__<server>__<tool-or-alias>. */
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
