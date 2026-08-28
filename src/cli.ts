#!/usr/bin/env bun
/**
 * abstract -- SDK harness CLI for the lab.
 *
 * Replaces the bin/ shell launchers. One entry point:
 *
 *   abstract              create or reattach the tmux ensemble (three panes,
 *                         one per role) anchored at the current project dir
 *   abstract __run <role> internal: run one role's pi session in this
 *                         terminal (spawned into tmux panes by `abstract`)
 *
 * Design: TODO.md decisions log ("SDK harness v1"). Three peer SDK
 * processes, one per pane, each a full pi InteractiveMode with:
 *   - agentDir pinned to this repository (SYSTEM.md, extensions/, skills/,
 *     settings.json are discovered natively)
 *   - a persistent per-role session at <project>/.pi/sessions/<role>.jsonl
 *   - motif.md + agents/<role>.md appended to the system prompt as file
 *     paths (DefaultResourceLoader re-reads them on every /reload)
 *   - HARNESS_ROLE set so extensions/cue self-configures
 *   - no context files (no ambient AGENTS.md/CLAUDE.md)
 *
 * Files are memory; processes are attention. Detaching tmux leaves agents
 * running; if the tmux server died, panes resume the same session files.
 */
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  InteractiveMode,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const ROLES = ["orchestrator", "engineer", "librarian"] as const;
type Role = (typeof ROLES)[number];

const CLI_PATH = realpathSync(fileURLToPath(import.meta.url));
const HARNESS_DIR = dirname(CLI_PATH).replace(/\/src$/, "");
const PI_AGENT_DIR = join(homedir(), ".pi", "agent");

function fail(message: string): never {
  console.error(`abstract: ${message}`);
  process.exit(1);
}

function tmux(args: string[], inheritStdio = false): string {
  try {
    return execFileSync("tmux", args, {
      encoding: "utf-8",
      stdio: inheritStdio ? "inherit" : ["ignore", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Create or reattach the three-pane tmux ensemble. */
function launch(): void {
  if (!tmux(["-V"])) fail("tmux not found (brew install tmux)");
  const cwd = process.cwd();
  const session = `abs-${basename(resolve(cwd))}`;
  const run = (role: Role) =>
    `${shQuote(process.execPath)} ${shQuote(CLI_PATH)} __run ${role}`;

  const has = (() => {
    try {
      execFileSync("tmux", ["has-session", "-t", session], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  if (has) {
    const panes = tmux(["list-panes", "-t", session]).trim().split("\n").filter(Boolean).length;
    if (panes === 3) {
      tmux(["attach-session", "-t", session], true);
      return;
    }
    console.error(`abstract: recreating session ${session} (layout stale; agent memory preserved in .pi/sessions/)`);
    tmux(["kill-session", "-t", session]);
  }

  tmux(["new-session", "-d", "-s", session, "-c", cwd, run("orchestrator")]);
  tmux(["split-window", "-h", "-t", `${session}:0`, "-c", cwd, run("engineer")]);
  tmux(["split-window", "-h", "-t", `${session}:0.1`, "-c", cwd, run("librarian")]);
  tmux(["select-layout", "-t", session, "even-horizontal"]);
  tmux(["attach-session", "-t", session], true);
}

/** Symlink a global pi config file into the harness agent dir. */
function linkGlobalConfig(name: string, required: boolean): void {
  const source = join(PI_AGENT_DIR, name);
  const target = join(HARNESS_DIR, name);
  if (!existsSync(source)) {
    if (required) fail(`${source} not found -- run pi once to set up credentials`);
    return;
  }
  try {
    if (lstatSync(target).isSymbolicLink() && realpathSync(target) === realpathSync(source)) return;
    unlinkSync(target);
  } catch {
    // missing or not removable as link; fall through to symlinkSync
  }
  symlinkSync(source, target);
}

/** Run one role's persistent interactive session in this terminal. */
async function runRole(role: Role): Promise<void> {
  process.env.HARNESS_ROLE = role;

  // Resource inheritance: credentials and model config come from the Pi
  // Agent global layer (~/.pi/agent) via symlinks; prompts and themes via
  // explicit paths; skills and MCP servers are NOT inherited. See TODO.md.
  linkGlobalConfig("auth.json", true);
  linkGlobalConfig("models.json", false);

  const cwd = process.cwd();
  mkdirSync(join(cwd, ".pi", "sessions"), { recursive: true });
  const sessionManager = SessionManager.open(join(cwd, ".pi", "sessions", `${role}.jsonl`));
  sessionManager.appendSessionInfo(role);

  const globalPrompts = join(PI_AGENT_DIR, "prompts");
  const globalThemes = join(PI_AGENT_DIR, "themes");

  const createRuntime: CreateAgentSessionRuntimeFactory = async ({
    cwd: effectiveCwd,
    agentDir,
    sessionManager: sm,
    sessionStartEvent,
  }) => {
    const settingsManager = SettingsManager.create(effectiveCwd, agentDir, {
      projectTrusted: false,
    });
    const services = await createAgentSessionServices({
      cwd: effectiveCwd,
      agentDir,
      settingsManager,
      modelRuntimeSignal: AbortSignal.timeout(15_000),
      resourceLoaderOptions: {
        noContextFiles: true,
        // File paths, not strings: DefaultResourceLoader reads them from
        // disk and re-resolves on every /reload, so edits to SYSTEM.md,
        // motif.md, or agents/<role>.md take effect without code changes.
        appendSystemPrompt: [
          join(HARNESS_DIR, "motif.md"),
          join(HARNESS_DIR, "agents", `${role}.md`),
        ],
        additionalPromptTemplatePaths: existsSync(globalPrompts) ? [globalPrompts] : [],
        additionalThemePaths: existsSync(globalThemes) ? [globalThemes] : [],
      },
    });
    const created = await createAgentSessionFromServices({
      services,
      sessionManager: sm,
      sessionStartEvent,
    });
    const diagnostics = [
      ...services.diagnostics,
      ...services.resourceLoader.getExtensions().errors.map(({ path, error }) => ({
        type: "error" as const,
        message: `Failed to load extension "${path}": ${error}`,
      })),
    ];
    return { ...created, services, diagnostics };
  };

  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd,
    agentDir: HARNESS_DIR,
    sessionManager,
  });

  const errors = runtime.diagnostics.filter((d) => d.type === "error");
  if (errors.length > 0) {
    for (const d of runtime.diagnostics) console.error(`${d.type}: ${d.message}`);
    process.exit(1);
  }

  const mode = new InteractiveMode(runtime, {
    startupDiagnostics: [...runtime.diagnostics],
    modelFallbackMessage: runtime.modelFallbackMessage,
  });
  await mode.run();
}

async function main(): Promise<void> {
  const [arg, ...rest] = process.argv.slice(2);
  if (arg === "__run") {
    const role = rest[0] as Role | undefined;
    if (!role || !ROLES.includes(role)) fail(`__run requires a role: ${ROLES.join("|")}`);
    await runRole(role);
    return;
  }
  if (arg === "--help" || arg === "-h") {
    console.log("usage: abstract          create/reattach the three-role tmux ensemble");
    console.log("       abstract __run r  internal: run role r in this terminal");
    return;
  }
  if (arg !== undefined) fail(`unknown argument: ${arg} (try --help)`);
  launch();
}

await main();
