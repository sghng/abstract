// Reload probe: verify MCP tools survive session.reload() (the /reload path).
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
const cwd = mkdtempSync(join(tmpdir(), "mcp-probe3-"));

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
await session.bindExtensions({
  // Mimic InteractiveMode: any binding makes hasBindings true, which is
  // what gates the session_start re-emit inside session.reload().
  shutdownHandler: () => {},
  onError: (err) => console.error("extension error:", err),
});
await new Promise((r) => setTimeout(r, 10_000));

const report = (label: string) => {
  const names = session.agent.state.tools.map((t) => t.name);
  console.log(`${label}: ${names.length} tools`);
  console.log("  " + names.join(", "));
};

report("before reload");

console.log("reloading...");
const t0 = Date.now();
await session.reload();
console.log(`reload returned in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await new Promise((r) => setTimeout(r, 10_000));
report("after reload");

process.exit(0);
