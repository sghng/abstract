// Probe 4: compaction priority. Seed a cue mid-turn, then /compact.
// Expect: compaction completes (not aborted by the cue); the cue is
// delivered AFTER compaction finishes.
process.env.HARNESS_ROLE = "engineer";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAgentSessionServices,
  createAgentSessionFromServices,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { ensureDirs, sendCue } from "../cue/core.ts";

const HARNESS_DIR = process.cwd();
const cwd = mkdtempSync(join(tmpdir(), "cue-probe4-"));
ensureDirs(cwd, ["orchestrator", "engineer", "librarian"]);

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
await session.bindExtensions({});

const order: string[] = [];
session.subscribe((event) => {
  if (event.type === "compaction_start") order.push("compaction_start");
  if (event.type === "compaction_end")
    order.push(`compaction_end aborted=${"aborted" in event ? event.aborted : "?"}`);
  if (event.type === "message_start" && event.message.role === "custom" && event.message.customType === "cue")
    order.push("cue_delivered");
});

await session.prompt("Reply with the single word: ready.");
await session.prompt(
  "Write a long essay (at least 1500 words) about the history of computing. Just the essay.",
);
// Pump context past keepRecentTokens (20k) so compaction has material to
// summarize: one large custom message, no turn triggered.
await session.sendCustomMessage({
  customType: "filler",
  display: false,
  content: [{ type: "text", text: "x".repeat(90_000) }],
});

// Cue lands right as we trigger compaction (the interrupt scenario).
sendCue(cwd, "orchestrator", "engineer", "probe cue: what is 2+2? Reply with just the number.");
await session.compact();

// Give deferred delivery (250ms) + the follow-up turn time to run.
await new Promise((r) => setTimeout(r, 60_000));

console.log("order:", order.join(" -> ") || "(no events)");
const ok =
  order.includes("compaction_end aborted=false") &&
  order.indexOf("compaction_start") < order.indexOf("cue_delivered");
console.log(ok ? "PASS: compaction completed, cue delivered after" : "CHECK ORDER ABOVE");
process.exit(ok ? 0 : 1);
