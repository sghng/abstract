/**
 * mcp -- the lab's own MCP integration.
 *
 * Replaces pi-mcp-adapter. Motivation: per-role, per-tool control over which
 * MCP capabilities each lab agent gets (context is attention; the engineer
 * should not carry the librarian's Zotero tools), curated tool surfaces
 * (the lab can rename/redescribe what the model sees), and loud, legible
 * failure (no hidden consent/cache state). Config format: core.ts.
 *
 * MCP tools register exactly like any extension tool (same registerTool
 * mechanism as cue): name, description, and input schema travel in the API
 * tools payload -- no prompt injection needed.
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
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { connectServer, type Connected } from "./client.ts";
import {
  mergeConfigs,
  parseConfig,
  planTools,
  serversForRole,
  toolName,
  type McpConfig,
} from "./core.ts";

/** Total text cap per tool result; larger payloads belong in files. */
const MAX_RESULT_CHARS = 64_000;

const HARNESS_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export function loadConfigLayers(cwd: string): { layers: McpConfig[]; errors: string[] } {
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

export default function (pi: ExtensionAPI) {
  const role = process.env.HARNESS_ROLE;
  if (!role) return; // lab-only, like cue

  const clients: import("@modelcontextprotocol/sdk/client/index.js").Client[] = [];

  function registerTools({ server, client, tools }: Connected): number {
    const planned = planTools(
      tools.map((t) => t.name),
      server.filters,
    );
    const byOrig = new Map(tools.map((t) => [t.name, t]));
    for (const plan of planned) {
      const advertised = byOrig.get(plan.orig)!;
      pi.registerTool({
        name: toolName(server.name, plan.alias),
        label: `${server.name}: ${plan.alias}`,
        description: plan.description ?? advertised.description ?? `MCP tool ${plan.orig} from ${server.name}`,
        // MCP inputSchema is plain JSON Schema; pi validates non-TypeBox
        // schemas via its coerceWithJsonSchema path.
        parameters: advertised.inputSchema as never,
        async execute(_id, params) {
          const result = await client.callTool({ name: plan.orig, arguments: params });
          const blocks = (result.content ?? []) as Array<{ type: string; text?: string }>;
          const text = blocks
            .map((block) => {
              if (block.type === "text") return block.text;
              return `[${block.type} content not rendered]`;
            })
            .join("\n");
          const truncated =
            text.length > MAX_RESULT_CHARS
              ? `${text.slice(0, MAX_RESULT_CHARS)}\n\n[truncated: ${text.length} chars total; ask the tool for a narrower query]`
              : text;
          if (result.isError) throw new Error(truncated || "MCP tool error");
          return {
            content: [{ type: "text", text: truncated || "(no output)" }],
            details: { server: server.name, tool: plan.orig },
          };
        },
      });
    }
    return planned.length;
  }

  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    const { layers, errors } = loadConfigLayers(ctx.cwd);
    const merged = mergeConfigs(layers);
    const servers = serversForRole(merged, role);
    const oauthSkipped = Object.entries(merged.mcpServers ?? {})
      .filter(([, c]) => c.auth === "oauth")
      .map(([name]) => name);

    const results = await Promise.allSettled(servers.map((s) => connectServer(s, `abstract-${role}`)));
    const connected: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const server = servers[i];
      if (result.status === "fulfilled") {
        clients.push(result.value.client);
        const count = registerTools(result.value);
        connected.push(`${server.name}(${count})`);
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
      ctx.ui.notify(`mcp: ${message}`, "error");
    }
    if (oauthSkipped.length) {
      ctx.ui.notify(`mcp: skipped oauth servers: ${oauthSkipped.join(", ")}`, "warning");
    }
  });

  pi.on("session_shutdown", async () => {
    for (const client of clients) {
      await client.close().catch(() => {});
    }
    clients.length = 0;
  });
}
