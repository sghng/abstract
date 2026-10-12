# Prompt prompting (2026-10-11)

Design exploration for restructuring abstract from a full infrastructure
(central server, six persistent roles, binder assembly) into a set of
skills plus a config repo that OpenCode consumes through its own discovery
mechanisms. This document is dated because we expect it to evolve; each
round either amends this file or opens a new dated one, and the history is
kept. The pre-restructure state is preserved as git tag `v1`.

## The question

A research project has many moving pieces, each needing carefully curated
instructions. The current answer is a harness that assembles them
(prompts/, binder.yaml, role sessions). The proposed answer is the Agent
Skills standard: one kernel (AGENTS.md instructions), many skills routed
by their descriptions, spawn-time agent briefs, and a per-project
opencode.json that mounts all of it. The survey below grounds the shape of
that answer in what Anthropic, OpenAI, and the community actually ship.

## Design constraints (Samuel, 2026-10-11)

1. A central `reference/` directory is questionable. Skills can bundle
   reference files (more than just SKILL.md), as RA's own skills do.
   Ticket, report, and memo templates may belong to a master research
   skill; they are inherent to it.
2. The lint is not fully functional: it goes to a staging area or stays
   hidden, not into the mounted skill set.
3. The writing skill is missing links: to the lint rules, and a reference
   to the style shelf.
4. Claim verification might be too granular as its own skill (judgment
   delegated to RA). The nlpatch skill could absorb into the word skill,
   since parsing and exporting to Word are essentially the same.
5. All merges and splits are tentative (literature search and Zotero
   operations might merge; writing might split further).
6. Survey existing solutions first (Anthropic, OpenAI, community
   publishers such as Matt Pocock).
7. Do not pin a default model in the template; the primary session model
   takes over. The real design surface is the subagent definitions: sane
   defaults both for model and for which task kinds get delegated.
8. Future work: delegation effort levels.

## Survey evidence

Full per-source notes live in the session transcript; the URLs below are
the durable pointers. Flagged items are things we could not verify.

### Anthropic: the spec and the official repo

- The spec (agentskills.io/specification): a skill is a directory with
  SKILL.md; frontmatter is `name` + `description` (required, kebab-case
  name matching the directory, description up to 1024 chars stating what
  and when) plus optional license/compatibility/metadata/allowed-tools
  (experimental). Progressive disclosure has exactly three levels: the
  metadata index (~100 tokens per skill), the SKILL.md body (guidance:
  under 500 lines), and bundled resources (unbounded, read on demand).
  Conventional subdirectories: `scripts/` (executed, treated as black
  boxes), `references/` (read on demand), `assets/` (templates, data).
  References stay one level deep from SKILL.md; files over 100 lines
  start with a table of contents to survive partial reads.
- anthropics/skills ships 19 skills flat under `skills/` (the earlier
  category-folder layout was abandoned); grouping happens at the
  marketplace layer (`.claude-plugin/marketplace.json`, 5 plugins).
  Internal layouts vary by need: pdf keeps reference files flat beside
  SKILL.md; mcp-builder uses a singular `reference/`; skill-creator
  carries its own `agents/` subagent prompts plus eval tooling;
  claude-api is a 105 KB routing index mapping file globs to per-language
  directories (a deliberate, shipped violation of the 500-line guidance).
- Authoring guidance, three layers (engineering blog; platform docs;
  agentskills.io creator guides): start with evaluation; keep the body
  concise; match degrees of freedom to task fragility; split when the
  body outgrows ~500 lines. The granularity rule, stated verbatim at
  agentskills.io/skill-creation/best-practices: design coherent units,
  like deciding what a function should do. Too narrowly scoped skills
  force multiple skills to load for a single task; too broad and they
  cannot activate precisely. Reference loading must be conditional ("read
  references/api-errors.md if the API returns non-200"), and gotchas stay
  inline in the body.
- Descriptions are the routing surface and Anthropic evaluates them like
  models: ~20 trigger queries (half should-trigger, half near-miss),
  three runs each, a 60/40 train/validation split, iterated
  (skill-creator automates this). Descriptions are deliberately "a little
  bit pushy" because models undertrigger.
- Claude Code adds a frontmatter superset (when_to_use, argument-hint,
  disable-model-invocation, user-invocable, model, effort, paths
  glob-gating, context: fork...) and seven discovery scopes (enterprise,
  personal, project, nested, add-dir, plugin, synced). Plugins and
  marketplaces (plugin.json / marketplace.json) are the sanctioned
  distribution units. No official staging or draft-skill convention
  exists anywhere in Anthropic's materials (searched spec, docs, repo).

### OpenAI Codex

- Four skill scopes: repo (`.agents/skills`, every directory from cwd up
  to repo root), user (`~/.agents/skills`), admin, and system (bundled
  `skill-creator`, `plan`, `skill-installer`). The index is capped at 2%
  of the context window, so descriptions front-load triggers because
  truncation cuts the tail. Jesse Vincent's reverse-engineered "Discovery"
  meta-skill account is confirmed for the December 2025 experimental
  build; the mechanism matches current docs, the exact paths have shifted
  (flag: treat his paths as historical).
- OpenAI's own catalog (openai/skills, now deprecated in favor of
  openai/plugins) organized skills as `.system/` (auto-installed),
  `.curated/` (~40), `.experimental/` (immature): a lifecycle taxonomy we
  can borrow. Distribution rule: bare folders for local use, plugins for
  anything distributable.
- AGENTS.md is now an open format stewarded by the Agentic AI Foundation
  (Linux Foundation), originating from OpenAI Codex, Amp, Jules, Cursor,
  and Factory jointly. Codex combines a global file with a root-to-cwd
  walk, deeper files winning conflicts.
- Codex has GA subagents: built-ins (default, worker, explorer) plus
  custom agents as TOML files (`.codex/agents/`, `~/.codex/agents/`)
  carrying name, description, developer_instructions, and optionally
  model, model_reasoning_effort, sandbox_mode, mcp_servers, skills.
  Reasoning effort resolves at three layers (spawn value, global
  `[agents]` default_subagent_reasoning_effort, agent file). Levels:
  low/medium/high/xhigh/max/ultra. ChatGPT's top "Ultra" tier is defined
  by proactive delegation policy itself, a precedent for effort levels
  governing when to delegate, not just how hard to think.
- OpenAI guidance: one job per skill; instructions over scripts unless
  determinism or external tooling is needed; references load one hop from
  SKILL.md, never in bulk.

### Community publishers

- "Matt Patak" does not exist; the intended person is **Matt Pocock**
  (mattpocock/skills, ~77k stars, "Straight from my .agents directory").
  His repo is categorized (skills/engineering, productivity, misc) and,
  most relevant to us, has an explicit lifecycle: `skills/in-progress/`
  (beta, excluded from the plugin and README until graduation) and
  `skills/deprecated/` (retired skills are deleted, the changeset names
  the replacement). Most of his skills set `disable-model-invocation:
  true` (user-invoked only). A setup skill writes repo-specific facts
  into the user's own AGENTS.md, keeping the skills generic.
- obra/superpowers (Jesse Vincent): 15 skills, flat, frontmatter is name
  + description only (no model pins, no tool lists), mandatory-trigger
  phrasing. Reference files bundle inside each skill; cross-skill sharing
  via relative links (`../using-superpowers/references/...`). Staging
  lives in a separate repo (superpowers-lab). Design history kept as
  dated docs under docs/plans/, the same convention this file follows.
- wshobson/agents: 92 category plugins, each bundling agents + commands +
  skills; model pins as harness-neutral aliases (`model: opus`) mapped by
  adapters. wshobson/commands is archived into the marketplace.
- vercel-labs/skills (`npx skills`): the de facto installer; project vs
  global, symlink vs copy; discovery walks three levels deep and
  recognizes `.curated/`, `.experimental/`, `.system/` containers plus a
  `metadata.internal: true` flag for WIP hiding.
- Awesome lists converge on vendor-official plus topic-community
  taxonomy; VoltAgent's list publishes quality standards (third-person
  what+when descriptions, metadata under ~100 tokens, body under 500
  lines, no absolute paths, scoped tools).
- OhMyOpenAgent keeps its roster as code modules, not markdown, with
  model+reasoning pins per agent and reusable categories (quick, deep,
  ultrabrain, visual-engineering) as model-tier presets.
- Pi (badlogic/pi-mono) implements the spec with the canonical
  SKILL.md + scripts/ + references/ + assets/ layout and ancestor-walking
  `.agents/skills/` discovery.

### Subagents and delegation

- Anthropic's multi-agent research system: one lead spawning ephemeral
  subagents, each briefed with exactly four things (objective, output
  format, tool/source guidance, task boundaries); effort scaling is
  prompt-embedded (fact-find: 1 agent, 3-10 calls; comparisons: 2-4
  agents; complex: 10+); outputs go to the filesystem, the lead receives
  references, not prose. Explicitly not for coupled work (most coding
  tasks).
- Claude Code subagent frontmatter is a constraint list (description for
  routing, tools, model, permissionMode, maxTurns, skills preload,
  mcpServers, isolation, and an `effort` field overriding the session's).
  A catch-all agent handles the unshaped task. Named agents are for
  recurring worker shapes; bare spawns with a good brief for one-offs.
- OpenCode: primary vs subagent modes; built-ins Build, Plan, General,
  Explore (read-only codebase), Scout (read-only external research);
  per-agent permission keys including `task` gating (deny removes the
  subagent from the Task tool description entirely); model pins per agent
  file; effort exists as model variants plus per-agent provider options
  (reasoningEffort), not as a delegation knob.
- OmO routes by intent category (quick/deep/ultrabrain...) bound to
  model+reasoning chains; its anti-over-delegation rule: before
  delegating, name the distinct value (specialization, parallel
  ownership, context isolation, scale); "merely avoiding direct work is
  not distinct value."
- Model pinning is a split ecosystem: wshobson pins by tier (haiku for
  deterministic fast work, sonnet for complex reasoning, opus for
  critical review) and Claude's built-ins pin cheap models for search;
  superpowers and mattpocock pin nothing. Our own visual-review pins a
  vision model for figure checks; the survey found no catalog doing
  exactly that (closest: wshobson's ui-visual-validator on sonnet, OmO's
  visual-engineering category), so that pin is our own mild innovation,
  kept deliberately.

## Judgments on the open calls

1. **Drop `reference/` entirely.** Confirmed by both Samuel's instinct
   and the dominant pattern: bundle into the owning skill
   (superpowers, ComposioHQ, anthropics all do this; the spec's
   assets/ + references/ conventions exist for it). Templates
   (ticket, report, memo) plus verification rules and logistics move into
   a master `research` skill as `assets/` and `references/`; the style
   shelf moves into `skills/writing/references/`; the presentation
   doctrine and deck starter move into `skills/presentation/`.
   Cross-skill sharing uses relative links (the superpowers pattern:
   journal-review may cite `../writing/references/style/`). Nothing
   central remains.
2. **Lint goes to `staging/`.** Anthropic has no staging convention; the
   community offers three (mattpocock's in-progress bucket, obra's
   separate lab repo, the installer's `.experimental/` container). We
   take the mattpocock shape adapted for directory mounting: a top-level
   `staging/` directory that the template's skills array never points at.
   Graduation = `git mv staging/lint skills/lint`.
3. **The writing skill gains its missing links**, as conditional
   references in the body (the spec's pattern): the lint rule set
   (`lint/rules.yaml`) when revising prose against house style, the
   bundled style shelf (`references/style/`) when choosing words or
   structuring sections, and the repertoire corpus when matching a
   venue's idiom.
4. **Claim verification folds into one `literature` skill.** The spec's
   narrow-scoping warning applies verbatim: search, import, and
   verification are one task flow (find papers, get them into Zotero,
   trust their claims), and splitting 133 lines of doctrine into three
   skills would force all three to load for any literature task. One
   skill, internal sections, conditional references. **nlpatch merges
   into a `word` skill**: nlpatch is the Word round-trip layer
   (tracked-changes DOCX in and out via pandoc) and typ2docx is the Word
   export layer; one domain, one skill covering both directions. The
   nlpatch subagent brief stays a separate file in `agents/`.
5. **Granularity test going forward**: the spec's coherent-unit rule,
   plus a trigger-eval pass (the Anthropic methodology: ~20 should-fire
   and near-miss prompts per skill) before any split or merge lands.
6. This survey.
7. **No default model pin in the template.** Delegation pins move off the
   kimi tiers on cost grounds: all delegated sidekicks run GLM 5.3 with
   reasoning effort maxed, except vision work on GLM 5.3 Flash with max
   reasoning and the external reviewer on deepseek-v4-pro (a deliberate
   different-vendor cold read). See the sidekick catalog below.
8. **Effort levels**: precedents are Claude Code's per-subagent `effort`
   field, Codex's three-layer reasoning-effort resolution, OmO's
   category chains, and OpenCode's per-agent `reasoningEffort`. For us:
   per-agent `reasoningEffort` pins where the task shape is known
   (scout low, reviewers high), and an effort vocabulary in the
   delegation doctrine for bare spawns. Deferred to its own round.

## The sidekick catalog (settled this round, after reading the full
## existing setup)

Flat by construction: every sidekick carries `permission: { task: deny }`,
which removes other agents from its Task tool description entirely, so
nested delegation is structurally impossible. This replaces the old
editor --> panel reviewers --> citation-check chain, which had two levels
of nesting. The primary leads every review directly.

| Brief | Model | Shape |
| ----- | ----- | ----- |
| reviewer-internal | glm-5.3, reasoning max | the auditor: validates the artifact against local truths (numbers vs the results registry, citations vs sources, prose vs the repertoire, consistency vs notes/, statistics completeness); aspects named in the spawn brief; read-only |
| reviewer-external | deepseek-v4-pro | the fresh eye: born blind (no story.md, no notes/), knows only venue and audience; persona, scope, and round (collegial/adversarial) come from the spawn brief; read-only |
| visual-review | glm-5.3-flash, reasoning max | rendered-figure soundness rubric; generation screening, not manuscript review |
| literature-lookup | glm-5.3, reasoning max | the quick delegation lane: a compact sourced answer over a topic, never an artifact; lasting facts land in the registry |
| literature-review | glm-5.3, reasoning max | the full structured corpus pass producing a memo |
| nlpatch | glm-5.3, reasoning max | mechanical Word round-trip; the protocol lives in the word skill |

Absorbed and retired: citation-check, stale-number-sweep, and style-check
fold into reviewer-internal as aspects (the old editor's aspects menu
becomes the spawn-time parameter); the editor is retired (leading the
panel was nested delegation) and its doctrine (panel composition, rounds,
aspects menu, the externalization gate, "consultant, not gate") moves to
the kernel's Review section; scout retires (the built-in Explore covers
recon; "say what you did not find" moves into the kernel's delegation
contract). The panel's lineage axis (one reviewer per model family) is
dropped on cost grounds: a single external reviewer.

The writer dissolves, but the delegation shape for drafting stays in the
kernel's delegation contract: drafting is delegated in section-sized
pieces, each spawn carrying the section scope, ticket/story pointers, an
instruction to load the writing skill, the output path under draft/, and
the return contract (path plus a short summary). The primary stitches and
owns voice consistency. No named writer brief: OpenCode agent definitions
cannot preload a skill, so a brief would just duplicate the writing
doctrine. If stitched drafts come back uneven in practice, the named
brief returns then (empiricism rule).

Model pin mechanics: GLM 5.3 via the z.ai coding plan (the RA profile's
own provider). OpenCode-format pins read `zai-coding-plan/glm-5.3` with
`reasoningEffort: "max"` as a provider pass-through (the agents doc's
additional-options mechanism). Verify at build time: the provider id on
the current daily install (provider renames are a documented failure
mode, see docs/models.md) and whether reasoningEffort max is accepted for
glm-5.3 or a variant entry is needed.

## Revised target structure

```
abstract/
├── AGENTS.md  MEMORY.md  manifesto.md     # dev-facing, as today
├── kernel.md                            # the kernel: invariants + delegation contract
├── skills/
│   ├── research/          # notes workflow; assets/ ticket+report+memo
│   │                      #   templates; references/ verification, logistics
│   ├── writing/           # style-guide + writing-craft; references/style/
│   ├── story-keeping/     # story doctrine + the keeping procedure
│   ├── literature/        # all of prompts/librarian.md, one coherent unit
│   ├── experiments/       # engineer + statistician doctrine, deduped
│   ├── presentation/      # doctrine + deck.typ starter as assets
│   ├── word/              # typ2docx export + nlpatch round-trip
│   ├── repertoire/        # corpus query scripts (new work)
│   └── grants/ journal-review/ typst/     # as-is, descriptions rewritten
├── staging/
│   └── lint/              # immature; never mounted by the template
├── agents/                # sidekick briefs: reviewer-internal, reviewer-external,
│                          #   visual-review, literature-lookup, literature-review,
│                          #   nlpatch (cue stripped; subagent denied on all)
├── typ2docx/  lint/  tools/  repertoire/  # code and data layers, unchanged
└── opencode.template.jsonc # skills + instructions + mcp; no model pin
```

Mounting (v2 mechanics, corrected after reading the v2 agents doc): the
project opencode.jsonc carries a `skills` array entry for
`~/dev/abstract/skills`, an `instructions` entry for `kernel.md` (flag:
issue #4758 reports a silent-load regression on one version, verify against
the installed runtime; a symlinked project-root AGENTS.md is the fallback),
and the mcp block (zotero remote over the tailnet). Sidekicks mount as
markdown files: `init` symlinks the repo's `agents/` into the project's
`.opencode/agents/` (the v2 markdown format carries model, permissions, and
the body as the system prompt; there is no config array for agent
directories, and the v1 `prompt: {file:}` route is deprecated). `abstract
init <dir>` writes the config and the symlinks and scaffolds the notes/
skeleton.

Corrections from the v2 docs read during the build: v2 has no built-in
scout agent (only general and explore; explore covers recon, including web
sources). The nesting denial is `{action: "subagent", resource: "*",
effect: "deny"}` in the ordered permissions list (the repo's existing
briefs already used this format). Model pins are `provider/model` with an
optional `#variant`; models.dev shows zai-coding-plan glm-5.3 and
glm-5.3-flash with reasoning support but no predefined variants, so max
reasoning goes in as a request body overlay (`reasoning_effort: max`) and
is the first thing to verify at validation.

## Validation gates (before any harness code is deleted)

1. A coding project shows no research skills in the index and no Zotero
   tools in context.
2. A research project shows the kernel combined, the skills indexed, and
   the MCP tools present.
3. Per-skill trigger tests: one prompt that should fire each skill and
   one that should not (the Anthropic eval criterion, scaled down).

## Open verification items

- The `instructions` array regression noted above.
- Per-agent skill visibility syntax in OpenCode v2 (permissions-based;
  claimed from docs, unverified against the pinned binary).
- Hindsight plugin configuration without the CLI's serverEnv injection
  (HINDSIGHT_CONFIG from the shell env).
- The desk as a standalone global plugin: its storage was lab-server
  backed and needs a local backend.
- Repertoire serving shape: query scripts plus a skill, or a small MCP.
  The largest single piece of new work.

## Sources

Anthropic: agentskills.io/specification; agentskills.io/skill-creation/
{best-practices,optimizing-descriptions,evaluating-skills};
anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills;
anthropic.com/engineering/multi-agent-research-system;
platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices;
code.claude.com/docs/en/{skills,sub-agents,plugins/overview,
plugins/marketplace-reference}; github.com/anthropics/skills.

OpenAI: learn.chatgpt.com/docs/{build-skills,agent-configuration/agents-md,
agent-configuration/subagents,config-file/config-reference};
github.com/openai/skills (deprecated) and github.com/openai/plugins;
agents.md; blog.fsck.com/2025/12/19/codex-skills;
simonw.substack.com/p/openai-are-quietly-adopting-skills.

Community: github.com/mattpocock/skills (incl. skills/in-progress/README.md);
github.com/obra/superpowers and /obra/superpowers-lab;
blog.fsck.com/2025/10/09/superpowers; github.com/wshobson/agents;
github.com/vercel-labs/skills; github.com/VoltAgent/awesome-agent-skills;
github.com/travisvn/awesome-claude-skills;
github.com/ComposioHQ/awesome-claude-skills;
github.com/kurochenko/skillbook;
irina.codes/keep-your-claude-code-agents-out-of-the-teams-repo;
github.com/code-yeongyu/oh-my-openagent (docs/guide/orchestration.md,
docs/guide/agent-model-matching.md, issues/6074);
github.com/badlogic/pi-mono (packages/coding-agent/docs/skills.md);
opencode.ai/docs/{agents,models}; kevinwelter.com/en/blog/claude-code-subagents.
