/**
 * Stateless MCP over Streamable HTTP: a fresh Server plus transport per
 * request (the SDK's stateless pattern). Tools are pure functions of the
 * request; all durable state lives in the artifact store on disk.
 *
 * Handlers are registered through the low-level setRequestHandler API
 * with plain JSON Schema, so the SDK and the root zod version never
 * have to agree.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolvePaper } from "./resolve.ts";
import { fetchPaper } from "./fetcher.ts";
import { readPages, findInPaper, exportPdf } from "./text.ts";

const TOOLS = [
  {
    name: "paper_resolve",
    description:
      "Resolve a DOI to merged metadata (Crossref, OpenAlex, Unpaywall) plus the fetch route. Cheap and cache-friendly; call it before fetching to triage. Returns title, journal, OA status and pdf link when one exists.",
    inputSchema: {
      type: "object",
      properties: { doi: { type: "string", description: "bare DOI, e.g. 10.1111/emip.70050" } },
      required: ["doi"],
    },
  },
  {
    name: "paper_fetch",
    description:
      "Fetch a paper's full text by DOI into the server-side store and extract page-anchored text. Submit-and-poll: returns state started or queued while the serial queue works; call again to poll; state ok means paper_read is ready. Failed fetches return state failed with a code (doi_not_registered, publisher_missing, challenge_needs_human, not_entitled, fetch_failed). Pass force to refetch after a failure.",
    inputSchema: {
      type: "object",
      properties: {
        doi: { type: "string" },
        force: { type: "boolean", description: "refetch even if a complete or failed artifact exists" },
      },
      required: ["doi"],
    },
  },
  {
    name: "paper_read",
    description:
      "Read a page range (1-based, inclusive) of a fetched paper's extracted text. Mirrors page-anchored reading: request the section you need, not the whole paper.",
    inputSchema: {
      type: "object",
      properties: {
        artifact: { type: "string", description: "artifact id returned by paper_fetch" },
        from: { type: "integer", description: "first page, 1-based" },
        to: { type: "integer", description: "last page, inclusive" },
      },
      required: ["artifact"],
    },
  },
  {
    name: "paper_find",
    description:
      "Locate a phrase in a fetched paper; returns page numbers with short snippets. The tool for claim verification before quoting a passage.",
    inputSchema: {
      type: "object",
      properties: {
        artifact: { type: "string" },
        query: { type: "string" },
      },
      required: ["artifact", "query"],
    },
  },
  {
    name: "paper_export",
    description:
      "Return the stored PDF as base64 for durable capture into the project references/ directory. Heavy; use only when the corpus needs the file itself, not for reading.",
    inputSchema: {
      type: "object",
      properties: { artifact: { type: "string" } },
      required: ["artifact"],
    },
  },
] as const;

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "paper_resolve":
      return resolvePaper(String(args.doi));
    case "paper_fetch":
      return fetchPaper(String(args.doi), args.force === true);
    case "paper_read": {
      const artifact = String(args.artifact);
      const from = Number(args.from ?? 1);
      const to = args.to === undefined ? from : Number(args.to);
      return readPages(artifact, from, to);
    }
    case "paper_find":
      return findInPaper(String(args.artifact), String(args.query));
    case "paper_export":
      return exportPdf(String(args.artifact));
    default:
      return { error: `unknown tool ${name}` };
  }
}

export async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("method not allowed\n");
    return;
  }
  const server = new Server({ name: "abstract", version: "0.1.0" }, { capabilities: { tools: {} } });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    let result: unknown;
    try {
      result = await callTool(name, args);
    } catch (e) {
      result = { error: e instanceof Error ? e.message : String(e) };
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 1) }] };
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}
