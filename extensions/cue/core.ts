/**
 * Cue fs core -- pure filesystem operations for the cue harness.
 *
 * The directory tree is the broker: sending is a file write into the
 * target's inbox, receiving is a directory scan, the ledger is derivable
 * from what sits in the inboxes. No daemon. See docs/harness.md.
 */
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export interface Envelope {
  v: 1;
  from: string;
  to: string;
  message: string;
  ts: number;
}

export interface Debt {
  from: string;
  ts: number;
  preview: string;
}

export interface CueState {
  /** Outstanding cues I sent, per target role (count). */
  awaiting: Record<string, number>;
  /** Cues delivered to me that I have not answered yet (FIFO). */
  debts: Debt[];
}

export const MAX_MESSAGE_BYTES = 32 * 1024;
const PROCESSED_KEEP = 100;

export const harnessDir = (cwd: string) => path.join(cwd, ".pi", "harness");
export const inboxDir = (cwd: string, role: string) =>
  path.join(harnessDir(cwd), "inbox", role);
const processedDir = (cwd: string, role: string) =>
  path.join(inboxDir(cwd, role), "processed");
export const statePath = (cwd: string, role: string) =>
  path.join(harnessDir(cwd), "state", `${role}.json`);

export function ensureDirs(cwd: string, roles: string[]): void {
  for (const r of roles) fs.mkdirSync(processedDir(cwd, r), { recursive: true });
  fs.mkdirSync(path.join(harnessDir(cwd), "state"), { recursive: true });
}

/** Write a cue into the target's inbox (atomic tmp + rename). */
export function sendCue(
  cwd: string,
  from: string,
  to: string,
  message: string,
  now = Date.now(),
): Envelope {
  if (Buffer.byteLength(message, "utf8") > MAX_MESSAGE_BYTES) {
    throw new Error(
      `cue exceeds ${MAX_MESSAGE_BYTES} bytes; put the content in a file and cue the path`,
    );
  }
  const env: Envelope = { v: 1, from, to, message, ts: now };
  const id = randomBytes(3).toString("hex");
  const dir = inboxDir(cwd, to);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp-${process.pid}-${id}`);
  fs.writeFileSync(tmp, `${JSON.stringify(env, null, 2)}\n`);
  fs.renameSync(tmp, path.join(dir, `${now}-${from}-${id}.json`));
  return env;
}

/** Pending cues for a role, FIFO order (filename sorts by timestamp). */
export function scanInbox(
  cwd: string,
  role: string,
): { file: string; env: Envelope }[] {
  const dir = inboxDir(cwd, role);
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: { file: string; env: Envelope }[] = [];
  for (const name of names
    .filter((n) => n.endsWith(".json") && !n.startsWith(".tmp-"))
    .sort()) {
    try {
      const env = JSON.parse(
        fs.readFileSync(path.join(dir, name), "utf8"),
      ) as Envelope;
      out.push({ file: name, env });
    } catch {
      // partial or corrupt file: skip
    }
  }
  return out;
}

/** Ack a delivered cue: move to processed/, prune old ones. */
export function ackCue(cwd: string, role: string, file: string): void {
  const dir = inboxDir(cwd, role);
  const proc = processedDir(cwd, role);
  fs.mkdirSync(proc, { recursive: true });
  try {
    fs.renameSync(path.join(dir, file), path.join(proc, file));
  } catch {
    // already gone
  }
  const names = fs
    .readdirSync(proc)
    .filter((n) => n.endsWith(".json"))
    .sort();
  for (const stale of names.slice(0, Math.max(0, names.length - PROCESSED_KEEP))) {
    try {
      fs.unlinkSync(path.join(proc, stale));
    } catch {
      // ignore
    }
  }
}

/** Read-only pending counts across all roles (for the status line). */
export function peekCounts(cwd: string, roles: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of roles) counts[r] = scanInbox(cwd, r).length;
  return counts;
}

export const emptyState = (): CueState => ({ awaiting: {}, debts: [] });

export function loadState(cwd: string, role: string): CueState {
  try {
    const s = JSON.parse(fs.readFileSync(statePath(cwd, role), "utf8")) as CueState;
    return { awaiting: s.awaiting ?? {}, debts: s.debts ?? [] };
  } catch {
    return emptyState();
  }
}

export function saveState(cwd: string, role: string, state: CueState): void {
  const p = statePath(cwd, role);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, p);
}
