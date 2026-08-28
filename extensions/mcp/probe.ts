// Probe: what tools does an actual AgentSession end up with?
process.env.HARNESS_ROLE = process.env.HARNESS_ROLE ?? "librarian";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAgentSessionServices,
  createAgentSessionFromServices,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const HARNESS_DIR = process.cwd();
const cwd = mkdtempSync(join(tmpdir(), "mcp-probe-"));

const settingsManager = SettingsManager.create(cwd, HARNESS_DIR, { projectTrusted: false });
const services = await createAgentSessionServices({
  cwd,
  agentDir: HARNESS_DIR,
  settingsManager,
  resourceLoaderOptions: { noContextFiles: true },
});
const { session } = await createAgentSessionFromServices({
  services,
  sessionManager: SessionManager.inMemory(cwd),
});
// InteractiveMode does this; it emits session_start.
await session.bindExtensions({});

// Let session_start handlers (mcp connects to MCP servers) settle.
await new Promise((r) => setTimeout(r, 30_000));

const names = session.agent.state.tools.map((t) => t.name);
console.log("active tools:", names.join(", "));
console.log("mcp tools:", names.filter((n) => n.startsWith("mcp__")).length);
const registered = services.resourceLoader
  .getExtensions()
  .extensions.flatMap((e) => [...e.tools.keys()]);
console.log("registered in extension objects:", registered.join(", ") || "(none)");
process.exit(0);
