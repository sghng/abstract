/**
 * scan.ts -- the Typst source scanner behind abstract lint: a thin wrapper
 * over the Rust extractor (lint/extract, parser-level typst-syntax, pinned
 * to the lab's installed typst).
 *
 * The contract any parser must satisfy is the Block: a paragraph-sized run
 * with its text (kept lines verbatim), its line range, the H1 section it
 * lives under, and a role (abstract, list, or body). All Typst dialect
 * knowledge lives in the extractor; this file only shells out. section and
 * role are optional because the prose route (stdin "-", or the tuning
 * tool's check-prose) lints a bare passage with no document around it.
 *
 * The binary is built lazily on first use: cargo builds it into the
 * abstract home, a hash of the crate sources stamps it, and a source change
 * triggers a rebuild. No TS fallback; cargo is a loud requirement, and
 * `abstract doctor` round-trips the contract.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Role = "abstract" | "list" | "body";

export interface Block {
  /** Kept lines verbatim, newline-joined. */
  text: string;
  /** 1-based source line of the first kept line. */
  start: number;
  /** 1-based source line of the last kept line. */
  end: number;
  /** Current H1 title ("" before the first H1, "abstract" for the
   *  abstract). Absent when the passage has no document around it. */
  section?: string;
  /** Absent when the passage has no document around it. */
  role?: Role;
}

const LINT_DIR = resolve(fileURLToPath(import.meta.url), "..");
const CRATE_DIR = join(LINT_DIR, "extract");
const ABSTRACT_HOME =
  process.env.ABSTRACT_HOME ?? join(homedir(), ".local", "share", "abstract");
const EXTRACT_HOME = join(ABSTRACT_HOME, "extract");
const BIN = join(EXTRACT_HOME, "abstract-extract");
const STAMP = join(EXTRACT_HOME, "stamp");

/** Hash of the crate sources; a change rebuilds the binary. */
function sourceStamp(): string {
  const srcs = readdirSync(join(CRATE_DIR, "src"))
    .sort()
    .map((name) => `src/${name}`);
  const names = ["Cargo.toml", "Cargo.lock", ...srcs];
  const hash = createHash("sha256");
  for (const name of names)
    hash.update(name + "\n" + readFileSync(join(CRATE_DIR, name)));
  return hash.digest("hex");
}

/** Ensure the extractor binary exists and matches its sources. */
export function ensureExtract(): string {
  if (
    existsSync(BIN) &&
    existsSync(STAMP) &&
    readFileSync(STAMP, "utf8") === sourceStamp()
  )
    return BIN;

  const probe = spawnSync("cargo", ["--version"], { encoding: "utf8" });
  if (probe.error)
    throw new Error(
      "cargo is required to build the lint extractor (brew install rust, or rustup)",
    );

  mkdirSync(EXTRACT_HOME, { recursive: true });
  process.stderr.write("abstract lint: building the extractor...\n");
  const build = spawnSync(
    "cargo",
    ["build", "--release", "--manifest-path", join(CRATE_DIR, "Cargo.toml")],
    {
      encoding: "utf8",
      env: { ...process.env, CARGO_TARGET_DIR: join(EXTRACT_HOME, "target") },
    },
  );
  if (build.status !== 0)
    throw new Error(
      `extractor build failed:\n${(build.stderr ?? "").slice(-2000)}`,
    );
  // A pid-suffixed temp keeps concurrent first builds from racing on the
  // rename (cargo serializes the build itself on the target-dir lock).
  const built = join(EXTRACT_HOME, "target", "release", "abstract-extract");
  const tmp = `${BIN}.${process.pid}.tmp`;
  copyFileSync(built, tmp);
  renameSync(tmp, BIN);
  writeFileSync(STAMP, sourceStamp());
  return BIN;
}

/** The extractor version string (for doctor). */
export function extractorVersion(): string {
  const r = spawnSync(ensureExtract(), ["--version"], { encoding: "utf8" });
  return r.stdout.trim() || "abstract-extract (unknown version)";
}

/** Scan a Typst source text (stdin to the extractor). */
export function scanText(source: string): Block[] {
  const r = spawnSync(ensureExtract(), {
    input: source,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0)
    throw new Error(`extractor failed: ${(r.stderr ?? "").slice(-500)}`);
  return JSON.parse(r.stdout) as Block[];
}

/** Scan a Typst file (path arg to the extractor). */
export function scanFile(path: string): Block[] {
  const r = spawnSync(ensureExtract(), [path], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0)
    throw new Error(`extractor failed: ${(r.stderr ?? "").slice(-500)}`);
  return JSON.parse(r.stdout) as Block[];
}
