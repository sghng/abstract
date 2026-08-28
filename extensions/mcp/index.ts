/**
 * mcp -- the lab's MCP integration. Replaces pi-mcp-adapter.
 *
 * Pure logic, no config: servers.ts lists the servers; on session_start we
 * connect, listTools, shape the list per server (servers.ts `map`), and
 * register each tool with pi under its final flat name -- exactly like our
 * own tools (cue). The model reads intent, not vendor.
 *
 * Self-configures from HARNESS_ROLE (set by the harness CLI); no-op outside
 * lab sessions. Scope: tools only, stdio + streamable-HTTP (SSE fallback),
 * no OAuth. Failures are loud (ui.notify) and never crash the session.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { connectServer, sanitizeName, type Connected, type Env } from "./client.ts";
import { SERVERS, type ServerDef } from "./servers.ts";

/** Total text cap per tool result; larger payloads belong in files. */
const MAX_RESULT_CHARS = 64_000;

const HARNESS_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** Secrets overlay: <harness>/mcp.secrets.json (gitignored), under process.env. */
function loadEnv(): Env {
  const env: Env = {};
  const path = join(HARNESS_DIR, "mcp.secrets.json");
  if (existsSync(path)) {
    try {
      Object.assign(env, JSON.parse(readFileSync(path, "utf-8")));
    } catch (error) {
      console.error(`mcp: could not parse ${path}: ${error}`);
    }
  }
  return { ...env, ...process.env };
}

export default function (pi: ExtensionAPI) {
  const role = process.env.HARNESS_ROLE;
  if (!role) return; // lab-only, like cue

  const servers = SERVERS.filter((s) => s.roles === "all" || s.roles.includes(role));
  const clients = new Map<string, Client>();
  const env = loadEnv();

  function registerTools({ server, client, tools }: Connected): number {
    const shaped = server.map ? server.map(tools) : tools;
    for (const tool of shaped) {
      const name = sanitizeName(tool.name);
      pi.registerTool({
        name,
        label: `${server.name}: ${name}`,
        description: tool.description ?? `MCP tool ${name} from ${server.name}`,
        // MCP inputSchema is plain JSON Schema; pi validates non-TypeBox
        // schemas via its coerceWithJsonSchema path.
        parameters: tool.inputSchema as never,
        async execute(_id, params) {
          const result = await client.callTool({ name: tool.calls, arguments: params });
          const blocks = (result.content ?? []) as Array<{ type: string; text?: string }>;
          const text = blocks
            .map((block) =>
              block.type === "text" ? block.text : `[${block.type} content not rendered]`,
            )
            .join("\n");
          const truncated =
            text.length > MAX_RESULT_CHARS
              ? `${text.slice(0, MAX_RESULT_CHARS)}\n\n[truncated: ${text.length} chars total; ask the tool for a narrower query]`
              : text;
          if (result.isError) throw new Error(truncated || "MCP tool error");
          return {
            content: [{ type: "text", text: truncated || "(no output)" }],
            details: { server: server.name, tool: tool.calls },
          };
        },
      });
    }
    return shaped.length;
  }

  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    const results = await Promise.allSettled(
      servers.map((server) => connectServer(server, `abstract-${role}`, env)),
    );
    const connected: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const server: ServerDef = servers[i];
      if (result.status === "fulfilled") {
        clients.set(server.name, result.value.client);
        connected.push(`${server.name}(${registerTools(result.value)})`);
      } else {
        failed.push(server.name);
        ctx.ui.notify(
          `mcp: ${server.name}: ${result.reason instanceof Error ? result.reason.message : result.reason}`,
          "error",
        );
      }
    }
    ctx.ui.setStatus(
      "mcp",
      connected.length || failed.length
        ? `mcp: ${connected.join(" ")}${failed.length ? ` | failed: ${failed.join(", ")}` : ""}`
        : undefined,
    );
  });

  pi.on("session_shutdown", async () => {
    for (const client of clients.values()) {
      await client.close().catch(() => {});
    }
    clients.clear();
  });
}
