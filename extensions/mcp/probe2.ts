// Definitive probe: real session, real model. Can the agent see/call MCP tools?
process.env.HARNESS_ROLE = process.env.HARNESS_ROLE ?? "engineer";
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
const cwd = mkdtempSync(join(tmpdir(), "mcp-probe2-"));

const settingsManager = SettingsManager.create(cwd, HARNESS_DIR, { projectTrusted: false });
const services = await createAgentSessionServices({
  cwd,
  agentDir: HARNESS_DIR,
  settingsManager,
  resourceLoaderOptions: { noContextFiles: true },
});
const { session } = await createAgentSessionFromServices({
  services,
  sessionManager: process.env.PROBE_RESUME
    ? SessionManager.open(process.env.PROBE_RESUME)
    : SessionManager.inMemory(cwd),
});
await session.bindExtensions({});
await new Promise((r) => setTimeout(r, 10_000));

console.log("model:", session.model?.id, session.model?.provider);
console.log("active:", session.agent.state.tools.map((t) => t.name).join(", "));

session.subscribe((event) => {
  if (event.type === "tool_execution_start") {
    console.log("TOOL CALL:", event.toolName);
  }
});

const question =
  process.argv[2] ??
  "List every tool you can call, one name per line. No commentary, just the names.";
await session.prompt(question);
const last = session.messages.at(-1);
if (last && "content" in last) {
  const text = (last.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  console.log("--- agent says ---\n" + text);
}
process.exit(0);
