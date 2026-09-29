# Session audit: writer on the q-matrix RnR revision (2026-09-17 to 09-24)

Scope: the writer's persistent session (ses_f504129cdffejYhsWLGVfWkIl8, glm-5.3,
2161 messages, 728k output tokens) plus the inbound record of ticket-007
(16 amendments), 33 memos, and the PI's 38 direct messages. Method: full
transcript digested mechanically, read in four parallel chunks by isolated
subagents, each producing a failure catalog with sequence-number citations;
quantitative signals (tool calls, error rates, message flow) computed from the
session DB. Findings below cite `#seq` in the writer session.

## The headline

The PI's experience of "I had to fix it over and over" is real, but the record
attributes it to three sources in roughly equal measure, and only one of them
is the writer's judgment:

1. **Writer failure classes** (below) — mostly mechanical or task-classification
   errors, not prose-quality errors.
2. **Specification churn from the PI/orchestrator** — the deliverable's
   requirements moved under the writer repeatedly (v5 patch killed and redefined
   the next morning; marking mechanism reversed twice in one afternoon; the
   style guide was recalibrated after the writer had executed its strict
   version for three days; a false "simulations came back" premise at #15910).
3. **Tool and environment failures** — repertoire 401 with no retry guidance,
   html-export blindness, pdftotext artifacts, edit-tool anchor fragility,
   temp-dir purges, truncated cue payloads.

Notably the arc ends well: the PI's last substantive message (#17060) reads
"Overall, though, I am very impressed, this writing has improved a lot." The
process converged, but at a high interaction cost.

## Common writer mistakes, ranked by cost

1. **Over-rewrite of human-calibrated prose (day one, the defining failure).**
   The first prose sweep (revision-v5.patch, #2065 era) made 26 judgment edits
   to "kill AI slop", formalized informal-but-human sentences, and stripped
   transitions the PI considers academic signature. The patch was killed and the
   round redefined (Amendment 2). Root cause: the writer's standing doctrine
   (style-guide + writing-craft: "merge and develop", "split semicolons", "cut
   anything that does not serve the narrative") points exactly opposite to what
   a revise-and-resubmit needs (the later Edit Scope Law: only the revised
   portion changes; submitted text is untouchable). The writer also never used
   the repertoire tool to calibrate before rewriting — the PI had to ask
   directly (#2484).
2. **Verifying a proxy instead of the artifact.** "Compiles clean" was claimed
   for a file the PI could not compile (#4041): verification ran on a
   sed-rewritten copy in a temp dir, image paths never resolved in place, and a
   piped `head` swallowed typst's exit code (#13564). Same family: two
   amendments of table checks were vacuous because the html exporter silently
   dropped tables; only PDF-text extraction (pypdf) saw the truth.
3. **Task-classification failures on simple asks.** Two opposite interventions:
   "You are clearly struggling at this task. Use subagents wisely" (#14449,
   serial grinding through parallelizable semicolon triage) and "No. Stop making
   things complex... you don't even have to read the whole thing, just start
   with one" (#15125, censuses and zone-maps built before simply reading two
   paragraphs and comparing). Same root: the writer defaults to
   instrumentation-first and does not first ask "is this a reading task, a
   judgment task, or a mechanical task?"
4. **Sweep methodology false negatives.** The most recurrent mechanical class:
   greps that miss variants (en-dash vs "to", curly apostrophes, capital-E
   "Exact-match" after reporting "zero strays" #14854), pdftotext line-wrap
   undercounts, exclusion filters hiding co-occurring sites, misremembered
   anchors. First pass of any sweep was reliably leaky; each specimen fed a
   battery rule, at a cost of a correction round each.
5. **Inventing machinery near constraint boundaries.** The `#fignote` element
   (#13458) was designed and twice-buggy before the PI ruled "the source
   invents NO new elements" (#13543). A plain `_Note._` paragraph was the
   answer all along.
6. **Batch abstraction over individual judgment.** Tuning false positives
   dispositioned "by family" missed true positives at a 5x rate (1.4% yield
   vs 6.9% on per-paragraph re-adjudication, #14270/#14572). The PI: "a true
   positive can hide inside a false family."
7. **Number discipline.** Deriving "16 to 18" from displayed table values
   instead of the registry (corrected to 16-17, #7988); a .0002 vs .0003 gap
   drift (#16067). The number protocol existed but was not the reflex.
8. **Fabricated forward references.** Twice wrote "detailed in supplementary
   materials" for supplementary materials that do not exist (#7988, #8444).

Counterweight, because it matters for the recommendations: the writer's
integrity is excellent. It refused the PI's false simulation premise and
verified at source before contradicting (#15910 round trip — the strongest
process moment in the record); it self-reported nearly every mechanical failure
unprompted; it caught arithmetic slips in orchestrator rulings (F4 "approximately
25" -> 26, upheld). The failure mode is not carelessness or dishonesty; it is
mis calibrated defaults under an unstable spec.

## What was NOT the writer's fault

- **A12 -> A13 -> A14**: the marking mechanism was retired, reverted, and
  restored in ~3.5 hours, all PI reversals (#12363, #12652, #12764). The PI
  apologized; cost was low only because the writer's round-trip discipline made
  flips mechanical.
- **Style-guide churn**: memo-017's false positives trace to a guide version
  "too strict" (#8850) that was later recalibrated — the writer was held to a
  ruler that moved.
- **The false-results premise** (#15910): "the simulations came back" had no
  basis in artifacts; the ordering was the G-DINA arm, not DINA.
- **Orchestrator errors**: a PI-bound round trip misrouted to the writer
  (#16095), cues claiming rules were on disk when they were not (#5730), a
  re-brief assuming an edit had landed that the corruption had eaten (#6674).
  The writer caught each.
- **Environment**: repertoire 401 (session-local; one retry fixed it, but the
  writer declared the tool "down" and stalled ~2h until nudged, #7442/#7475);
  glob blind to the notes/ symlink; temp purges destroying snapshots; no
  version control in the project (Fossil never used for this), so every
  destructive pass rode on manual cp.

## Prompt and tool improvements

Prompts (the highest-leverage fix is doctrinal, not stylistic):

1. **Add a revision-mode override to the writer binder.** A
   `revision-doctrine.md` loaded for revise-and-resubmit work: the submitted
   text is calibrated ground truth; preserve by default; changes only where a
   review comment motivates one; when the ticket says "revision", the
   story-doctrine's rewrite instincts are suspended. The v5 kill and the
   "Prior Art" embarrassment (#14912) are both this conflict. State it once,
   positively, in the binder — not in the 9th amendment.
2. **Put the task-classification question in the writer prompt.** Before
   executing any ask: classify it (read / judge / sweep / build) and match the
   method — reading tasks get reading, not censuses; mechanical breadth gets
   subagents. The PI should not have to say "stop making things complex".
3. **First-use rule for repertoire.** The writer owns a corpus tool built to
   arbitrate register; it used it 13 times in a week and had to be told. The
   binder should bind it: any register or style judgment on deliverable prose
   is grounded in a repertoire query first.
4. **Numbers from the registry only** is already lab law but needs to live in
   the writer's own file, with the "never re-derive from displayed table
   values" clause spelled out.

Tools:

5. **Verify-the-artifact rule, mechanized.** A `lab-check` command (or a skill)
   that compiles the deliverable in place, checks exit codes un-piped, and
   extracts from the rendered PDF — would have prevented the single worst
   credibility failure (#4041) and the html-exporter vacuity. Make it the only
   sanctioned way to claim "compiles clean".
6. **Sweep harness.** The false-negative taxonomy (dash variants, case,
   line-wrap, apostrophes, exclusion filters) is already ledgered in the
   project; graduate it into the lint/extract sidecar or a writer skill so the
   first pass of a sweep is not reliably leaky. `abstract lint` exists — wire
   these pattern classes into it.
7. **Repertoire resilience.** Retry once with backoff inside the tool before
   surfacing an error; the error text should say "retry, then route to
   orchestrator" so a session-local 401 never becomes a 2-hour stall.
8. **Cue payloads must not truncate.** Amendment 16's cue (#13922) arrived cut
   mid-sentence; the writer had to rebuild the directive from the ticket. Either
   cues stay short pointers by convention (enforced) or the cue tool warns on
   length. The kernel already says "a short pointer or question, never a
   document" — the orchestrator violated its own rule under load.
9. **Snapshot discipline.** No SCM on the manuscript dir plus 24h temp purges
   means manual `cp` snapshots are load-bearing. Either a `lab-snapshot`
   convention (versioned copies under a durable dir) or actually use Fossil
   for draft/.

## Delegation, reflected

This audit was also an experiment in practicing what the record preaches, and
it bore out the lab kernel's delegation doctrine:

- **Chunked isolation works.** A 17.5MB transcript is unread in one context;
  four subagents each read ~290KB digests and returned cited catalogs for ~3
  minutes of wall time. The parent context stayed small enough to synthesize.
- **The digest layer was the winning move.** Raw JSON transcripts are
  token-poison; reducing each message to role + first 2.5KB + tool-call
  one-liners preserved every failure marker while cutting ~15x. A reusable
  `session-digest` script (sqlite -> markdown digest) would make future audits
  a single command.
- **The writer's F5/F6 lessons generalize.** The same misclassification risk
  exists for the auditor: mechanical digestion is delegable, judgment
  (weighing blame between writer, PI, and tools) stayed with the parent and
  could not have been outsourced without losing the cross-chunk patterns
  (e.g., the A12-14 arc spans chunks; only the parent sees it whole).

## Addendum: delegation design (verified 2026-09-28)

The audit's F5/F6 findings prompted a check of what OpenCode 2.0.18 actually
teaches about delegation, answered from the pinned binary (strings-extracted),
the plugin hook log, and the upstream git history:

- The lab never removed any OpenCode prompt; the harness plugin only appends
  (hook log shows 4 base parts + 4 binder parts for the writer).
- Upstream removed the delegation doctrine itself, twice, deliberately:
  `8640ea3374` "minimize system prompt" (#42638, Aug 14) deleted the 95-line
  v2 base prompt that said "prefer to use the subagent tool" for file search;
  `8068c5e48c` (#46753, Sep 2) added an explicit gate for GPT models ("Do not
  spawn subagents unless the user or applicable AGENTS.md/skill instructions
  explicitly ask"). GLM and other non-gated families get a 10-line minimal
  prompt with zero delegation content. The kernel is now the only delegation
  teacher, and the old kernel section was written for a prompt era that ended.
- The tool schema carries all mechanics (spawn semantics, fresh-context briefs,
  sessionID continuation, background mode) AND the full named catalog: the
  binary appends "Available subagents: - id: description" to the tool
  description at runtime, per request.
- Usage data confirms the gate model: 13 subagent calls in 8 days, all
  immediately downstream of an explicit ask (kernel-assigned panel, PI nudge,
  orchestrator lanes); engineer, statistician, librarian: zero.

Design decision: the kernel's Delegation section shrinks to a steer plus the
one fact the schema cannot carry (context economics). No tool naming, no
categories, no mechanics, no catalog. The graduation rule (recurring bespoke
delegation gets named, proposed to the orchestrator) moves to the orchestrator
role prompt. `abstract doctor` gains a check that the kernel and the pinned
binary agree on the tool name, so upstream renames or prompt flips fail loudly.
Before/after metric from the lab DB: subagent calls per role per day and
sessionID resume usage (currently zero).

## How to audit better next time

1. **Build the tooling first, once.** A small CLI over the lab DB
   (`~/.local/share/abstract/lab.db`): `sessions <project>`, `digest <session>`
   (role-tagged markdown), `inbound <session>` (cues + user messages only),
   `tools <session>` (call/error stats). This audit hand-rolled all four; the
   next one should be one command per view.
2. **Seed subagents with the failure-questionnaire, not just the data.** The
   four-part brief (rework catalog / patterns / quotes / prompt-tool failures)
   produced uniformly structured, cited reports. Make that brief a template.
3. **Chunk by episode, not by bytes.** Equal-byte chunks split the A12-14 arc
   and the Round-2 launch across chunk boundaries, forcing each subagent to
   reconstruct context. Chunk on amendment boundaries or day boundaries next
   time.
4. **Pull the counterpart sessions selectively.** Only the writer was audited
   here; the orchestrator's outbound cues (readable in the writer's inbound)
   were a sufficient proxy, but blame attribution between orchestrator
   routing and writer execution would benefit from spot-checking the
   orchestrator session for the 3-4 flagged incidents (misroute #16095,
   re-brief #6674).
5. **Define the metric before reading.** "Rework rate" (deliverables rejected
   / corrected per round) is computable from the cue stream and would turn
   this from narrative into a time series the lab can watch. The raw material
   (accept/reject cues) is already structured.
6. **Audit the stable state, not the storm.** Days 1-2 carry the churn of
   spec-finding; the writer's steady-state behavior (post-Amendment 9) is
   substantially better. A future audit should separate formation cost from
   steady-state quality, or it will overcorrect on day-one evidence.
