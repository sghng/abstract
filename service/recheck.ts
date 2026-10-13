#!/usr/bin/env bun
/**
 * Elsevier cooldown recheck, armed by the abstract-elsevier-recheck
 * user timer (every 6 h). Self-guarding: it force-refetches only when
 * the 24 h cooldown stored in the artifact meta has expired, so the
 * timer cadence never produces more than one real attempt per cooldown
 * cycle. Every run appends one line to
 * service/data/logs/elsevier-recheck.jsonl; read that file to see the
 * armed outcome without re-provoking ScienceDirect.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ARTIFACTS, LOGS } from "./src/store.ts";

const doi = process.argv[2] ?? "10.1016/j.compedu.2026.105751";
const id = doi.replace(/\//g, "_");
const metaPath = path.join(ARTIFACTS, `${id}.meta.json`);
const logPath = path.join(LOGS, "elsevier-recheck.jsonl");
const COOLDOWN_MIN = 1440;

const log = (o: Record<string, unknown>) =>
  appendFileSync(logPath, JSON.stringify({ at: new Date().toISOString(), doi, ...o }) + "\n");

if (!existsSync(metaPath)) {
  log({ outcome: "no-meta" });
  process.exit(0);
}
const meta = JSON.parse(readFileSync(metaPath, "utf8"));
if (meta.complete) {
  log({ outcome: "already-complete" });
  process.exit(0);
}
if (!meta.error?.at) {
  log({ outcome: "no-error-meta" });
  process.exit(0);
}
const left = COOLDOWN_MIN - (Date.now() - Date.parse(meta.error.at)) / 60_000;
if (left > 0) {
  log({ outcome: "cooldown-active", minutes_left: Math.ceil(left) });
  process.exit(0);
}

// cooldown expired: one guarded attempt through the service's own queue
const base = process.env.ABSTRACT_URL ?? "http://127.0.0.1:4857";
const post = async (body: unknown): Promise<any> => {
  const r = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  const line = t.split("\n").find((l) => l.startsWith("data:"));
  return line ? JSON.parse(line.slice(5)) : JSON.parse(t);
};
const call = (name: string, args: unknown) =>
  post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });

await call("paper_fetch", { doi, force: true });
let last = "{}";
for (let i = 0; i < 5; i++) {
  await new Promise((r) => setTimeout(r, 30_000));
  const d = await call("paper_fetch", { doi });
  last = d?.result?.content?.[0]?.text ?? "{}";
  if (/"state": "(ok|failed)"/.test(last)) break;
}
let result: unknown = last;
try {
  result = JSON.parse(last);
} catch {
  /* keep raw */
}
log({ outcome: "attempted", result });
