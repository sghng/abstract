/**
 * Smoke test for the cue extension: spawn a librarian RPC session (pi must
 * be on PATH; no provider call needed), drop a cue in its inbox, verify the
 * extension delivers it. Run: bun extensions/cue/smoke.ts
 */
import * as fs from "node:fs";
import { sendCue } from "./core.ts";

const cwd = process.env.SMOKE_DIR ?? "/tmp/cue-smoke";
const agentDir = new URL("../..", import.meta.url).pathname;

fs.rmSync(cwd, { recursive: true, force: true });
fs.mkdirSync(cwd, { recursive: true });

const proc = Bun.spawn(
  ["pi", "--mode", "rpc", "--session", ".pi/sessions/lib.jsonl", "--no-context-files"],
  {
    cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
    env: {
      ...process.env,
      HARNESS_ROLE: "librarian",
      PI_CODING_AGENT_DIR: agentDir,
    },
  },
);

let log = "";
const reader = proc.stdout.getReader();
const pump = (async () => {
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    log += dec.decode(value);
  }
})();

await new Promise((r) => setTimeout(r, 4000)); // let the extension init
sendCue(cwd, "orchestrator", "librarian", "smoke: prior art on cue protocols?");
await new Promise((r) => setTimeout(r, 4000)); // let the watcher fire + inject

proc.kill();
await pump;

const inboxEmpty =
  fs.readdirSync(`${cwd}/.pi/harness/inbox/librarian`).filter((n) => n.endsWith(".json"))
    .length === 0;
const delivered = log.includes("cue from orchestrator");

console.log("inbox empty:", inboxEmpty);
console.log("cue message in event stream:", delivered);
if (inboxEmpty && delivered) {
  console.log("SMOKE OK");
} else {
  console.log("SMOKE FAIL");
  process.exit(1);
}
