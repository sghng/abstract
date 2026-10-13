#!/usr/bin/env bun
/**
 * Acceptance smoke for the abstract-mcp service.
 *
 *   bun service/smoke.ts resolve <doi>
 *   bun service/smoke.ts fetch <doi>      (direct, bypasses MCP)
 *   bun service/smoke.ts read <artifact> <from> <to>
 *   bun service/smoke.ts find <artifact> <phrase...>
 *   bun service/smoke.ts search <query> [k=v ...]   (limit=, year_from=,
 *                                           year_to=, min_citations=)
 *   bun service/smoke.ts mcp <doi>        (full MCP round trip against
 *                                           a running server)
 */
import { resolvePaper } from "./src/resolve.ts";
import { fetchPaper } from "./src/fetcher.ts";
import { readPages } from "./src/text.ts";

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "resolve": {
    console.log(JSON.stringify(await resolvePaper(rest[0]), null, 1));
    break;
  }
  case "fetch": {
    const r = fetchPaper(rest[0], true);
    console.log("submit:", JSON.stringify(r));
    // poll in-process until the queue finishes this job
    for (let i = 0; i < 40; i++) {
      await new Promise((r2) => setTimeout(r2, 3000));
      const again = fetchPaper(rest[0]);
      console.log("poll:", again.state, again.error?.code ?? "");
      if (again.state === "ok" || again.state === "failed") {
        if (again.state === "ok") {
          const p = readPages(again.artifact, 1, 1);
          console.log("pages:", p.total_pages, "| page 1 head:", p.text.slice(0, 120).replace(/\s+/g, " "));
        }
        break;
      }
    }
    break;
  }
  case "read": {
    console.log(JSON.stringify(readPages(rest[0], Number(rest[1]), Number(rest[2])), null, 1).slice(0, 1500));
    break;
  }
  case "find": {
    const { findInPaper } = await import("./src/text.ts");
    console.log(JSON.stringify(findInPaper(rest[0], rest.slice(1).join(" ")), null, 1).slice(0, 2500));
    break;
  }
  case "search": {
    const { searchPapers } = await import("./src/search.ts");
    const o: Record<string, number> = {};
    for (const kv of rest.slice(1)) {
      const [k, v] = kv.split("=");
      if (v !== undefined) o[k] = Number(v);
    }
    console.log(JSON.stringify(await searchPapers(rest[0], o), null, 1).slice(0, 4000));
    break;
  }
  case "mcp": {
    const base = process.env.ABSTRACT_URL ?? "http://127.0.0.1:4857";
    const post = async (body: unknown) => {
      const r = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      const line = text.split("\n").find((l) => l.startsWith("data:"));
      return line ? JSON.parse(line.slice(5)) : JSON.parse(text);
    };
    const init = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "smoke", version: "0" } },
    });
    console.log("initialize:", JSON.stringify(init.result?.serverInfo));
    const tools = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    console.log("tools:", tools.result?.tools?.map((t: { name: string }) => t.name).join(", "));
    const call = await post({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "paper_resolve", arguments: { doi: rest[0] } },
    });
    console.log("paper_resolve:", call.result?.content?.[0]?.text?.slice(0, 400));
    break;
  }
  default:
    console.log("usage: smoke resolve|fetch|read|find|search|mcp ...");
}
