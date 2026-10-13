/**
 * abstract-mcp: the lab's MCP service, streamable HTTP at /mcp.
 *
 * Serves paper fetch (DOI to page-anchored full text) and later the
 * repertoire query. Runs natively under Bun on the lab host; the
 * deployment side (tailnet, TLS, systemd) is the owner's. Binds
 * 127.0.0.1:<ABSTRACT_PORT, default 4670>. An optional bearer token
 * via ABSTRACT_TOKEN gates /mcp when set.
 *
 * Served through node:http, not Bun.serve: the SDK's streamable
 * transport wants Node-style (req, res) pairs.
 */
import { createServer } from "node:http";
import { handleMcp } from "./mcp.ts";
import { resetBrowser } from "./browser.ts";

const HOST = process.env.ABSTRACT_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ABSTRACT_PORT ?? 4857);

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok\n");
    return;
  }
  if (url !== "/mcp") {
    res.writeHead(404);
    res.end("not found\n");
    return;
  }
  const token = process.env.ABSTRACT_TOKEN;
  if (token && req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(401);
    res.end("unauthorized\n");
    return;
  }
  void handleMcp(req, res).catch(() => {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("internal error\n");
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`abstract-mcp listening on http://${HOST}:${PORT}/mcp`);
});

// graceful stop: close the browser (chromium exits cleanly, profile
// intact), then the listener, then exit. Without this bun waits out
// systemd's stop timeout with live chromium children.
const shuttingDown = async (sig: string) => {
  console.log(`${sig} received, shutting down`);
  try {
    await resetBrowser();
  } catch {
    /* already gone */
  }
  server.close();
  process.exit(0);
};
process.on("SIGTERM", () => void shuttingDown("SIGTERM"));
process.on("SIGINT", () => void shuttingDown("SIGINT"));
