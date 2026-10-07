#!/usr/bin/env bun
/**
 * abstract -- the lab harness CLI (OpenCode v2).
 *
 * One central per-host "Abstract" server runs the lab: a pinned
 * @opencode/cli install spawned with a lab-owned environment (config dir,
 * database, state, credentials synced from the daily install). Research
 * projects get five persistent role sessions (created once, metadata.role,
 * per project directory). The TUI attaches to the server; sessions outlive
 * views, so detach is "close the TUI, re-run abstract".
 *
 *   abstract              ensure runtime, server, credentials, and the five
 *                         role sessions for the current project; attach the
 *                         TUI (one tab per role session)
 *   abstract context [role] [--json]
 *                         print what each agent receives: context pieces,
 *                         skills, subagents, tools (static; live when up)
 *   abstract typ2docx <file.typ>
 *                         convert a Typst source to Word beside it, through
 *                         a house reference stock rebuilt fresh from the
 *                         patch series (citeproc, native numbering, float
 *                         placement fixpoint); no server or model involved
 *   abstract lint <file.typ|file.md> | -   [--threshold p] [--explain ids]
 *                         style-check a manuscript (or one plain prose
 *                         passage on stdin) against the style rule set
 *                         via Jev; exit 1 flags violations
 *   abstract stop         stop the lab server
 *
 * Files are memory; sessions are a lossy cache. The server is the only
 * long-running thing, and it is rebuildable from the DB.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenCode } from "@opencode/client";
import { ROLES } from "./binder.ts";
import { buildReport, renderReport } from "./context.ts";

const CLI_PATH = resolve(fileURLToPath(import.meta.url));
const HARNESS_DIR = resolve(CLI_PATH, "..", "..");
const CONFIG_DIR = join(HARNESS_DIR, "config");
// The hindsight plugin resolves its config file from the env at process
// start; the lab's copy sits with the lab config, committed with the repo.
const HINDSIGHT_CONFIG_FILE = join(CONFIG_DIR, "hindsight.json");

const PKG = JSON.parse(
  readFileSync(join(HARNESS_DIR, "package.json"), "utf8"),
) as { dependencies: Record<string, string> };
// The @opencode/* deps move in lockstep; the runtime serves the same version.
const PIN = PKG.dependencies["@opencode/client"];

const ABSTRACT_HOME =
  process.env.ABSTRACT_HOME ?? join(homedir(), ".local", "share", "abstract");
const RUNTIME_DIR = join(ABSTRACT_HOME, "runtime");
const BIN = join(RUNTIME_DIR, "node_modules", ".bin", "opencode");
const DB_PATH = join(ABSTRACT_HOME, "lab.db");
const STATE_HOME =
  process.env.ABSTRACT_STATE ?? join(homedir(), ".local", "state", "abstract");
const LOGS_DIR = join(ABSTRACT_HOME, "logs");
const SERVER_LOG = join(LOGS_DIR, "server.log");
const PID_FILE = join(ABSTRACT_HOME, "server.pid");
const PW_FILE = join(ABSTRACT_HOME, "server.pw");

const DAILY_DB = join(homedir(), ".local", "share", "opencode", "opencode.db");
const PORT = Number(process.env.ABSTRACT_PORT ?? 4319);
const URL = `http://127.0.0.1:${PORT}`;
// The TUI persists its tab bar under <state>/<channel>/tui/tabs.json, scoped
// per cwd. The channel is a build-time constant of the binary ("latest" for
// npm releases); honor the same override env the binary does.
const CHANNEL = process.env.OPENCODE_CHANNEL ?? "latest";
const TUI_TABS_FILE = join(STATE_HOME, "opencode", CHANNEL, "tui", "tabs.json");

function fail(message: string): never {
  console.error(`abstract: ${message}`);
  process.exit(1);
}

/** Secrets for the server env: repo .env plus mcp.secrets.json, both optional. */
function loadSecrets(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(join(HARNESS_DIR, ".env"), "utf8").split(
      "\n",
    )) {
      const m = line.match(/^(\w+)=(.*)$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].trim();
    }
  } catch {}
  try {
    const secrets = JSON.parse(
      readFileSync(join(HARNESS_DIR, "mcp.secrets.json"), "utf8"),
    );
    for (const [k, v] of Object.entries(secrets as Record<string, string>))
      if (!(k in process.env)) env[k] = v;
  } catch {}
  return env;
}

function serverEnv(): Record<string, string> {
  const pw = readFileSync(PW_FILE, "utf8").trim();
  return {
    ...loadSecrets(),
    OPENCODE_CONFIG_DIR: CONFIG_DIR,
    OPENCODE_DISABLE_PROJECT_CONFIG: "1",
    XDG_STATE_HOME: STATE_HOME,
    OPENCODE_DB: DB_PATH,
    OPENCODE_DISABLE_AUTOUPDATE: "1",
    OPENCODE_PASSWORD: pw,
    ABSTRACT_SERVER_URL: URL,
    // Lab-owned, so it wins over any inherited shell export; set only when
    // the lab ships the file, else the plugin keeps its per-user default.
    ...(existsSync(HINDSIGHT_CONFIG_FILE)
      ? { HINDSIGHT_CONFIG: HINDSIGHT_CONFIG_FILE }
      : {}),
  };
}

function client() {
  const pw = readFileSync(PW_FILE, "utf8").trim();
  const headers = {
    Authorization: "Basic " + Buffer.from(`opencode:${pw}`).toString("base64"),
  };
  return OpenCode.make({ baseUrl: URL, headers });
}

/* -- runtime ------------------------------------------------------------ */

function ensureRuntime(): void {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  const pkg = join(RUNTIME_DIR, "package.json");
  if (!existsSync(pkg))
    writeFileSync(pkg, '{"name":"abstract-runtime","private":true}\n');
  const installed = existsSync(BIN);
  let version = "";
  if (installed) {
    version = spawnSync(BIN, ["--version"], { encoding: "utf8" }).stdout.trim();
  }
  if (!installed || !version.includes(PIN)) {
    console.log(
      `abstract: installing @opencode/cli@${PIN} into ${RUNTIME_DIR}`,
    );
    const out = spawnSync("bun", ["add", "-E", `@opencode/cli@${PIN}`], {
      cwd: RUNTIME_DIR,
      encoding: "utf8",
    });
    if (out.status !== 0) fail(`runtime install failed: ${out.stderr}`);
  }
}

/* -- server ------------------------------------------------------------- */

function ensurePassword(): void {
  if (!existsSync(PW_FILE)) {
    writeFileSync(PW_FILE, randomBytes(24).toString("hex"));
    chmodSync(PW_FILE, 0o600);
  }
}

async function healthy(): Promise<string> {
  try {
    const info = await client().server.info();
    return info.version;
  } catch {
    return "";
  }
}

async function ensureServer(): Promise<void> {
  mkdirSync(LOGS_DIR, { recursive: true });
  mkdirSync(STATE_HOME, { recursive: true });
  if (await healthy()) return;

  if (existsSync(PID_FILE)) {
    const pid = Number(readFileSync(PID_FILE, "utf8"));
    try {
      process.kill(pid, 0);
      process.kill(pid, "SIGTERM");
    } catch {}
  }
  const logFd = openSync(SERVER_LOG, "a");
  const child = spawn(
    BIN,
    ["serve", "--hostname", "127.0.0.1", "--port", String(PORT)],
    {
      env: { ...process.env, ...serverEnv() },
      // The server's cwd is the repo hindsight adopts for git ingestion and
      // its codebase survey; the harness repo must never be that (the lab
      // memory bank would fill with harness commits), so anchor it to the
      // lab home, which is no repo at all.
      cwd: ABSTRACT_HOME,
      stdio: ["ignore", logFd, logFd],
      detached: true,
    },
  );
  writeFileSync(PID_FILE, String(child.pid));
  child.unref();
  closeSync(logFd);

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const v = await healthy();
    if (v) {
      if (!v.includes(PIN)) fail(`server reports ${v}, pin is ${PIN}`);
      return;
    }
  }
  fail(`server did not become healthy; see ${SERVER_LOG}`);
}

/**
 * Config/agent/plugin discovery is asynchronous after boot; a check fired
 * the instant health passes races it. Wait until the lab's agents surface.
 */
async function awaitDiscovery(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    try {
      const a = await client().agent.list();
      if (ROLES.every((r) => a.data.some((x: any) => x.id === r))) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  fail("lab agents never appeared; config discovery failed (see server log)");
}

/**
 * Credentials live in the DB, and a fresh lab DB never imports the daily
 * auth.json (legacy imports run only on upgrade). Copy credential rows from
 * the daily install so the lab shares the user's providers. The daily DB
 * stays canonical: every launch re-syncs.
 */
function syncCredentials(): void {
  if (!existsSync(DAILY_DB)) return;
  const sql =
    `ATTACH '${DAILY_DB}' AS daily;` +
    "INSERT OR REPLACE INTO credential SELECT * FROM daily.credential;" +
    "DETACH daily;";
  const out = spawnSync("sqlite3", [DB_PATH, sql], { encoding: "utf8" });
  if (out.status !== 0 && out.stderr)
    console.error(`abstract: credential sync: ${out.stderr.trim()}`);
}

/* -- sessions ----------------------------------------------------------- */

type Session = { id: string; metadata?: Record<string, unknown> | null };

/**
 * The TUI's tab bar is a persisted, route-driven set: a tab appears when a
 * client navigates to a session, not when the session exists. `abstract`
 * ensures the ensemble, so it seeds the lab TUI's tabs file with the five
 * role sessions (merged, never overwritten; user-added tabs survive).
 */
function seedTabs(dir: string, byRole: Map<string, Session>): void {
  mkdirSync(dirname(TUI_TABS_FILE), { recursive: true });
  let file: {
    global?: unknown;
    cwd?: Record<
      string,
      {
        tabs?: { sessionID: string; title?: string }[];
        unread?: Record<string, unknown>;
      }
    >;
  } = {};
  try {
    file = JSON.parse(readFileSync(TUI_TABS_FILE, "utf8"));
  } catch {}
  file.cwd ??= {};
  const scope = (file.cwd[dir] ??= { tabs: [], unread: {} });
  scope.tabs ??= [];
  const ids = new Set(scope.tabs.map((t) => t.sessionID));
  for (const role of ROLES) {
    const s = byRole.get(role);
    if (s && !ids.has(s.id)) scope.tabs.push({ sessionID: s.id, title: role });
  }
  const tmp = TUI_TABS_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(file));
  renameSync(tmp, TUI_TABS_FILE);
}

async function roleSessions(dir: string): Promise<Map<string, Session>> {
  const listed = await client().session.list({
    directory: dir,
    parentID: null,
  });
  const byRole = new Map<string, Session>();
  for (const s of listed.data) {
    // A fork carries its parent's role metadata (parent_id is null and
    // metadata is copied verbatim), so without this filter the fork and the
    // live session both claim the role and list order decides the winner.
    if (s.fork) continue;
    const role = (s.metadata as Record<string, unknown> | undefined)?.role;
    if (typeof role === "string") byRole.set(role, s);
  }
  return byRole;
}

async function ensureSessions(dir: string): Promise<Map<string, Session>> {
  let byRole = await roleSessions(dir);
  for (const role of ROLES) {
    if (byRole.has(role)) continue;
    const created = await client().session.create({
      title: role,
      agent: role,
      location: { directory: dir },
      metadata: { role },
    });
    byRole.set(role, created);
    console.log(`abstract: created ${role} session (${basename(dir)})`);
  }
  return byRole;
}

/* -- commands ----------------------------------------------------------- */

async function launch(): Promise<void> {
  const dir = resolve(process.cwd());
  ensurePassword();
  ensureRuntime();
  await ensureServer();
  syncCredentials();
  const byRole = await ensureSessions(dir);
  seedTabs(dir, byRole);

  // The TUI is a pure client of the lab server, but its local state (tabs,
  // prompt history) must stay out of the daily install: same state root as
  // the lab server. cwd pins the TUI's tab scope to the project directory.
  const env = {
    ...process.env,
    OPENCODE_PASSWORD: readFileSync(PW_FILE, "utf8").trim(),
    XDG_STATE_HOME: STATE_HOME,
  };
  const orchestrator = byRole.get("orchestrator")!;
  const tui = spawnSync(
    BIN,
    [dir, "--server", URL, "--session", orchestrator.id],
    { env, stdio: "inherit", cwd: dir },
  );
  if (tui.status && tui.status !== 0) fail(`tui exited with ${tui.status}`);
}

async function stop(): Promise<void> {
  if (!existsSync(PID_FILE)) {
    console.log("abstract: no server pid file (nothing to stop)");
    return;
  }
  const pid = Number(readFileSync(PID_FILE, "utf8"));
  try {
    process.kill(pid, "SIGTERM");
    console.log(`abstract: stopped server (pid ${pid})`);
  } catch {
    console.log("abstract: server already stopped");
  }
}

/* -- context -------------------------------------------------------------- */

/**
 * abstract context [role] [--json]
 *
 * Prints what each agent receives: the always-on context (kernel +
 * prompts, exactly as the plugin assembles it), the on-demand skills
 * index, the subagent catalog, and the tool surface. Static from disk;
 * enriched with live registry/status data when the server is reachable.
 * Read-only: never boots the server.
 */
async function contextCmd(role?: string, json = false): Promise<void> {
  if (role && !ROLES.includes(role as never))
    fail(`unknown role: ${role} (one of ${ROLES.join(", ")})`);
  let live: Parameters<typeof buildReport>[0] | undefined;
  const version = await healthy();
  if (version) {
    try {
      const api = client();
      const [a, m, s0] = await Promise.all([
        api.agent.list(),
        api.mcp.list(),
        api.skill.list(),
      ]);
      // Fresh-boot discovery is async: an empty skill list means "not ready
      // yet", not "nothing discovered". Poll briefly before flagging.
      let skills = new Set(s0.data.map((x: any) => x.name ?? x.id));
      for (let i = 0; i < 10 && skills.size === 0; i++) {
        await new Promise((r) => setTimeout(r, 500));
        skills = new Set(
          (await api.skill.list()).data.map((x: any) => x.name ?? x.id),
        );
      }
      const agents = new Map(
        a.data.map((x: any) => [
          x.id,
          {
            model:
              typeof x.model === "string"
                ? x.model
                : (x.model?.id ?? x.model?.modelID),
            description: x.description,
            denied: (x.permissions ?? [])
              .filter((p: any) => p.effect === "deny")
              .map((p: any) => p.action),
          },
        ]),
      );
      const mcp = new Map(
        m.data.map((x: any) => {
          const st = x?.status;
          return [x.name, typeof st === "string" ? st : st?.status] as [
            string,
            string | undefined,
          ];
        }),
      );
      live = { version, agents, mcp, skills };
    } catch {}
  }
  const report = buildReport(live);
  if (role) {
    report.roles = report.roles.filter((r) => r.role === role);
    report.subagents = report.roles[0]?.subagents ?? report.subagents;
  }
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(renderReport(report, role));
}

/* -- main ---------------------------------------------------------------- */

/* -- typ2docx ------------------------------------------------------------- */
// The typ2docx command lives in typ2docx/cli.ts (reference stock, pandoc
// runs, float placement fixpoint); main() imports it lazily.

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case undefined:
      await launch();
      return;
    case "typ2docx": {
      const { typeToDocx } = await import("../typ2docx/cli.ts");
      await typeToDocx(rest);
      return;
    }
    case "lint": {
      const { lint } = await import("../lint/cli.ts");
      await lint(rest);
      return;
    }
    case "context":
      await contextCmd(
        rest.find((a) => !a.startsWith("--")),
        rest.includes("--json"),
      );
      return;
    case "stop":
      await stop();
      return;
    case "--help":
    case "-h":
      console.log(
        "usage: abstract          ensure runtime/server/sessions for the current project, attach the TUI",
      );
      console.log("       abstract context [role] [--json]");
      console.log(
        "                     print each agent's context, skills, subagents, tools",
      );
      console.log(
        "       abstract typ2docx <file.typ> [--no-floats] [--max-passes N]",
      );
      console.log(
        "                     convert Typst to Word beside it (house stock, citeproc,",
      );
      console.log(
        "                     float placement fixpoint; --keep-scratch keeps temps)",
      );
      console.log(
        "       abstract lint <file.typ|file.md> | -   [--threshold p] [--explain ids]",
      );
      console.log(
        "                     style-check a manuscript, or one prose passage on",
      );
      console.log(
        "                     stdin, against the style rules (R53 p=.78 hits)",
      );
      console.log("       abstract stop     stop the lab server");
      return;
    default:
      fail(`unknown argument: ${cmd} (try --help)`);
  }
}

await main();
// The SDK leaves pooled handles behind; a finished CLI exits, it does not idle.
process.exit(0);
