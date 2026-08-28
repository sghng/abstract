/**
 * mcp -- client plumbing shared by the pi extension (index.ts) and the dev
 * utilities (inspect.ts, smoke.ts). Connects one configured server and lists
 * its tools; transport selection and the SSE fallback live here.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { RoleServer } from "./core.ts";

export const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;

export interface ListedTool {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface Connected {
  server: RoleServer;
  client: Client;
  tools: ListedTool[];
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

/** Connect to a server and list its advertised tools (unfiltered). */
export async function connectServer(server: RoleServer, clientName: string): Promise<Connected> {
  const client = new Client({ name: clientName, version: "1.0.0" }, { capabilities: {} });
  const timeout = server.config.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
  const connect = (transport: Transport) => client.connect(transport, { timeout });

  if (server.kind === "remote") {
    try {
      await connect(makeTransport(server));
    } catch {
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
  const tools = listed.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
  return { server, client, tools };
}
