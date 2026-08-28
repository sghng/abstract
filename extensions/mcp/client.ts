/**
 * mcp -- client plumbing: connect one server, list its tools. Shared by the
 * pi extension (index.ts) and the dev utilities (inspect.ts, smoke.ts).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ServerDef } from "./servers.ts";

export const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;

export interface ListedTool {
  /** Tool name to register with pi (after any server-side `map` shaping). */
  name: string;
  /** Upstream tool name to invoke on the server. */
  calls: string;
  description?: string;
  inputSchema: unknown;
}

export interface Connected {
  server: ServerDef;
  client: Client;
  tools: ListedTool[];
}

export type Env = Record<string, string | undefined>;

/** Expand ${VAR} references. Unknown vars expand to "". */
export function expandEnv(value: string, env: Env): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => env[name] ?? "");
}

/** Make a name safe for pi tool registration. */
export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function makeTransport(server: ServerDef, env: Env): Transport {
  if (server.url) {
    return new StreamableHTTPClientTransport(new URL(expandEnv(server.url, env)));
  }
  return new StdioClientTransport({
    command: server.command!,
    args: (server.args ?? []).map((a) => expandEnv(a, env)),
    env: {
      ...getDefaultEnvironment(),
      ...Object.fromEntries(
        Object.entries(server.env ?? {}).map(([k, v]) => [k, expandEnv(v, env)]),
      ),
    },
    stderr: "pipe",
  });
}

/** Connect to a server and list its advertised tools (unmapped). */
export async function connectServer(
  server: ServerDef,
  clientName: string,
  env: Env,
): Promise<Connected> {
  const client = new Client({ name: clientName, version: "1.0.0" }, { capabilities: {} });
  const timeout = server.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
  const connect = (transport: Transport) => client.connect(transport, { timeout });

  if (server.url) {
    try {
      await connect(makeTransport(server, env));
    } catch {
      // Fall back to SSE for older remote servers.
      await client.close().catch(() => {});
      await connect(new SSEClientTransport(new URL(expandEnv(server.url, env))));
    }
  } else {
    await connect(makeTransport(server, env));
  }

  const listed = await client.listTools();
  const tools = listed.tools.map((t) => ({
    name: t.name,
    calls: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
  return { server, client, tools };
}
