/**
 * Conductor -- the lab's own MCP integration.
 *
 * Replaces pi-mcp-adapter. Motivation: per-role, per-tool control over which
 * MCP capabilities each lab agent gets (context is attention; the engineer
 * should not carry the librarian's Zotero tools), and loud, legible failure
 * (no hidden consent/cache state). Config format and filtering: core.ts.
 *
 * Loaded into every lab session from the agent dir; self-configures from
 * HARNESS_ROLE (set by the harness CLI). No-op in non-lab sessions.
 *
 * Scope (v1): tools only (no resources/prompts), stdio + streamable-HTTP
 * transports (SSE fallback), no OAuth. Servers marked "auth": "oauth" are
 * skipped with a startup warning.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  filterToolNames,
  mergeConfigs,
  parseConfig,
  serversForRole,
  toolName,
  type McpConfig,
  type RoleServer,
} from "./core.ts";

/** Total text cap per tool result; larger payloads belong in files. */
const MAX_RESULT_CHARS = 64_000;
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;

const HARNESS_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function loadConfigLayers(cwd: string): { layers: McpConfig[]; errors: string[] } {
  const paths = [
    join(HARNESS_DIR, "mcp.json"),
    join(cwd, ".mcp.json"),
    join(cwd, ".pi", "mcp.json"),
  ];
  const layers: McpConfig[] = [];
  const errors: string[] = [];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      layers.push(parseConfig(readFileSync(path, "utf-8"), path));
    } catch (error) {
      errors.push(`${path}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return { layers, errors };
}

function makeTransport(server: RoleServer): Transport {
  const { config } = server;
  if (server.kind === "remote") {
    return new StreamableHTTPClientTransport(new URL(config.url!), {
      requestInit: config.headers ? { headers: config.headers } : undefined,
    });
  }
  return new StdioClientTransport({
    command: config.command!,
    args: config.args ?? [],
    env: { ...getDefaultEnvironment(), ...(config.env ?? {}) },
    stderr: "pipe",
  });
}

interface Connected {
  server: RoleServer;
  client: Client;
  tools: { name: string; description?: string; inputSchema: unknown }[];
}

export default function (pi: ExtensionAPI) {
  const role = process.env.HARNESS_ROLE;
  if (!role) return; // lab-only, like cue

  const clients: Client[] = [];

  async function connectServer(server: RoleServer): Promise<Connected> {
    const client = new Client(
      { name: `abstract-${role}`, version: "1.0.0" },
      { capabilities: {} },
    );
    const timeout = server.config.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
    const connect = (transport: Transport) =>
      client.connect(transport, { timeout });

    if (server.kind === "remote") {
      try {
        await connect(makeTransport(server));
      } catch (error) {
        // Fall back to SSE for older remote servers.
        await client.close().catch(() => {});
        const sse = new SSEClientTransport(new URL(server.config.url!), {
          requestInit: server.config.headers ? { headers: server.config.headers } : undefined,
        });
        await connect(sse);
      }
    } else {
      await connect(makeTransport(server));
    }

    const listed = await client.listTools();
    const wanted = new Set(
      filterToolNames(
        listed.tools.map((t) => t.name),
        server.filter,
      ),
    );
    const tools = listed.tools
      .filter((t) => wanted.has(t.name))
      .map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
    return { server, client, tools };
  }

  function registerTools({ server, client, tools }: Connected): void {
    for (const tool of tools) {
      pi.registerTool({
        name: toolName(server.name, tool.name),
        label: `${server.name}: ${tool.name}`,
        description: tool.description ?? `MCP tool ${tool.name} from ${server.name}`,
        // MCP inputSchema is plain JSON Schema; pi validates non-TypeBox
        // schemas via its coerceWithJsonSchema path.
        parameters: tool.inputSchema as never,
        async execute(_id, params) {
          const result = await client.callTool({ name: tool.name, arguments: params });
          const blocks = (result.content ?? []) as Array<{ type: string; text?: string }>;
          const text = blocks
            .map((block) => {
              if (block.type === "text") return block.text;
              return `[${block.type} content not rendered by conductor]`;
            })
            .join("\n");
          const truncated =
            text.length > MAX_RESULT_CHARS
              ? `${text.slice(0, MAX_RESULT_CHARS)}\n\n[truncated: ${text.length} chars total; ask the tool for a narrower query]`
              : text;
          if (result.isError) throw new Error(truncated || "MCP tool error");
          return {
            content: [{ type: "text", text: truncated || "(no output)" }],
            details: { server: server.name, tool: tool.name },
          };
        },
      });
    }
  }

  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    const { layers, errors } = loadConfigLayers(ctx.cwd);
    const merged = mergeConfigs(layers);
    const servers = serversForRole(merged, role);
    const oauthSkipped = Object.entries(merged.mcpServers ?? {})
      .filter(([, c]) => c.auth === "oauth")
      .map(([name]) => name);

    const results = await Promise.allSettled(servers.map(connectServer));
    const connected: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const server = servers[i];
      if (result.status === "fulfilled") {
        clients.push(result.value.client);
        registerTools(result.value);
        connected.push(`${server.name}(${result.value.tools.length})`);
      } else {
        failed.push(server.name);
        errors.push(`${server.name}: ${result.reason instanceof Error ? result.reason.message : result.reason}`);
      }
    }

    const parts: string[] = [];
    if (connected.length) parts.push(connected.join(" "));
    if (failed.length) parts.push(`failed: ${failed.join(", ")}`);
    if (oauthSkipped.length) parts.push(`skipped (oauth unsupported): ${oauthSkipped.join(", ")}`);
    ctx.ui.setStatus("mcp", parts.length ? `mcp: ${parts.join(" | ")}` : undefined);

    for (const message of errors) {
      ctx.ui.notify(`conductor: ${message}`, "error");
    }
    if (oauthSkipped.length) {
      ctx.ui.notify(`conductor: skipped oauth servers: ${oauthSkipped.join(", ")}`, "warning");
    }
  });

  pi.on("session_shutdown", async () => {
    for (const client of clients) {
      await client.close().catch(() => {});
    }
    clients.length = 0;
  });
}
