/**
 * mcp -- the lab's MCP servers, as code.
 *
 * Building MCP integration by not building it: this is not an interface
 * for hooking random MCPs. It is an internal adapter that lets us register
 * new tools without implementing them -- the implementation hides behind a
 * server URL (or command). The wiring IS this list; there is no config
 * file. Each server's tool list is shaped in plain functions, and the
 * resulting flat tool definitions register with pi exactly like our own
 * tools (cue), in one namespace.
 *
 * Secrets: ${VAR} placeholders in url/env expand from process.env, overlaid
 * with <harness>/mcp.secrets.json (gitignored; flat {"KEY": "..."}).
 *
 * Scoping: `roles` lists which lab roles get the server (HARNESS_ROLE).
 */
import type { ListedTool } from "./client.ts";

export interface ServerDef {
  /** Provenance label (status line, tool labels, logs). */
  name: string;
  /** Which roles get this server, or "all". */
  roles: string[] | "all";
  /** Remote server URL (streamable HTTP, SSE fallback). */
  url?: string;
  /** Stdio server. */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  startupTimeoutMs?: number;
  /** Shape the fetched tool list before registration. Identity if omitted. */
  map?: (tools: ListedTool[]) => ListedTool[];
}

export const SERVERS: ServerDef[] = [
  {
    name: "tavily",
    roles: "all",
    url: "https://mcp.tavily.com/mcp/?tavilyApiKey=${TAVILY_API_KEY}",
    // The model should read intent, not vendor: tavily_search -> web_search.
    map: (tools) => tools.map((t) => ({ ...t, name: t.name.replaceAll("tavily", "web") })),
  },
  {
    name: "context7",
    roles: ["orchestrator", "engineer"],
    url: "https://mcp.context7.com/mcp",
  },
  {
    name: "zotero",
    roles: ["librarian"],
    // Trim: no annotation- or library-management tools.
    map: (tools) =>
      tools.filter((t) => !t.name.includes("annotation") && !t.name.includes("libra")),
    command: "uvx",
    args: ["--from", "zotero-mcp-server", "zotero-mcp"],
    env: {
      ZOTERO_LOCAL: "true",
      ZOTERO_EMBEDDING_MODEL: "openai",
      OPENAI_API_KEY: "${OPENAI_API_KEY}",
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
      ZOTERO_API_KEY: "${ZOTERO_API_KEY}",
      ZOTERO_LIBRARY_ID: "9358581",
      ZOTERO_LIBRARY_TYPE: "user",
    },
    startupTimeoutMs: 120_000,
  },
];
