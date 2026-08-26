import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  ackCue,
  emptyState,
  ensureDirs,
  inboxDir,
  loadState,
  peekCounts,
  scanInbox,
  sendCue,
  saveState,
} from "./core.ts";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cue-test-"));
  ensureDirs(dir, ["orchestrator", "librarian"]);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("sendCue / scanInbox", () => {
  test("writes into the target inbox only, FIFO by timestamp", () => {
    sendCue(dir, "orchestrator", "librarian", "first", 1000);
    sendCue(dir, "orchestrator", "librarian", "second", 2000);
    const got = scanInbox(dir, "librarian");
    expect(got.map((g) => g.env.message)).toEqual(["first", "second"]);
    expect(got[0].env.from).toBe("orchestrator");
    expect(got[0].env.to).toBe("librarian");
    expect(scanInbox(dir, "orchestrator")).toEqual([]);
  });

  test("rejects oversize messages", () => {
    expect(() => sendCue(dir, "a", "b", "x".repeat(33 * 1024))).toThrow(/32/);
  });

  test("ignores corrupt and tmp files", () => {
    sendCue(dir, "orchestrator", "librarian", "real", 1000);
    fs.writeFileSync(path.join(inboxDir(dir, "librarian"), "9999-x-y.json"), "{bad");
    fs.writeFileSync(path.join(inboxDir(dir, "librarian"), ".tmp-1-2"), "{}");
    const got = scanInbox(dir, "librarian");
    expect(got.map((g) => g.env.message)).toEqual(["real"]);
  });
});

describe("ackCue", () => {
  test("moves the cue to processed/", () => {
    sendCue(dir, "orchestrator", "librarian", "hi", 1000);
    const [next] = scanInbox(dir, "librarian");
    ackCue(dir, "librarian", next.file);
    expect(scanInbox(dir, "librarian")).toEqual([]);
    const proc = fs.readdirSync(path.join(inboxDir(dir, "librarian"), "processed"));
    expect(proc).toEqual([next.file]);
  });

  test("prunes processed/ to the last 100", () => {
    for (let i = 0; i < 105; i++) {
      sendCue(dir, "orchestrator", "librarian", `m${i}`, 1000 + i);
    }
    for (const { file } of scanInbox(dir, "librarian")) ackCue(dir, "librarian", file);
    const proc = fs
      .readdirSync(path.join(inboxDir(dir, "librarian"), "processed"))
      .sort();
    expect(proc.length).toBe(100);
    expect(proc[0]).toContain("1005"); // oldest five pruned
  });
});

describe("state", () => {
  test("round-trips and survives a missing file", () => {
    expect(loadState(dir, "orchestrator")).toEqual(emptyState());
    const s = emptyState();
    s.awaiting.librarian = 2;
    s.debts.push({ from: "librarian", ts: 1, preview: "hi" });
    saveState(dir, "orchestrator", s);
    expect(loadState(dir, "orchestrator")).toEqual(s);
  });
});

describe("peekCounts", () => {
  test("counts pending cues per role", () => {
    sendCue(dir, "orchestrator", "librarian", "a", 1);
    sendCue(dir, "orchestrator", "librarian", "b", 2);
    expect(peekCounts(dir, ["orchestrator", "librarian"])).toEqual({
      orchestrator: 0,
      librarian: 2,
    });
  });
});
