# Reflection

How the lab reviews its own doctrine. Semi-automatic by design: the owner
triggers a batch, the lab's forks do the reflecting, and the owner ratifies the
result. Less automated than the Hermes agent's per-turn background review,
deliberately: one ratification point, and it is the owner.

## The Arc

The design was settled against the pinned binary's mechanics, not analogy:

1. **Hermes inspiration** (`agent/background_review.py`): after a turn, fork the
   agent, replay the conversation snapshot, ask "should any skill/memory be
   saved or updated?". Writes go straight to the stores; containment is a
   dispatch-side tool whitelist. Single agent, so no coordination problem.
2. **Fork semantics probe** (live, against the pinned server): a fork has
   `parent_id: null`, inherits `metadata.role` verbatim, and lists ahead of its
   parent. Both cue's target lookup and the CLI's roleSessions could resolve a
   role to its fork.
3. **The invariant**: a role session is a top-level session with no fork
   lineage. cue refuses forked callers and skips forked targets; `roleSessions`
   skips forks. Isolation of reflection forks is therefore mechanical: a fork
   cannot cue out, and nothing can cue in, even if the live lab is not
   quiescent.
4. **The nested-children variant was rejected.** A fork cannot be a child (the
   fork API hardcodes `parent_id: null`), so nesting role reflections under the
   orchestrator's fork would mean fresh child sessions plus export/import of
   raw, pre-compaction history: token-heavy, cache-cold, and reliant on import
   behavior not meant for it. Forks carry the post-compaction,
   context-window-faithful transcript and replay on the same prompt-cache
   prefix, which is the substance of the technique. Batch organization comes
   from titles (`reflect-<role>-NNN`), batch metadata, and `session.background`
   marking instead.

## The Batch

`/reflect` is a plugin command (`src/reflect.ts`, registered by the harness; the
driver lives in src/ because every file in `config/plugin/` must itself be a
plugin), gated to the orchestrator session. One batch at a time, server-wide.

0. **Snapshot** `prompts/` and `reference/` (minus build artifacts) as the diff
   baseline.
1. **Discover** the live role sessions in the project (top level, no fork
   lineage).
2. **Ack** in the invoking session; the batch runs detached.
3. **Phase 1, concurrent**: fork each non-orchestrator role at its tip, retitle,
   stamp batch metadata, mark background, deliver the role brief, wait (15 min;
   interrupt on timeout), harvest the closing summary.
4. **Diff** the doctrine trees (`diff -ruN`; `binder.yaml` rides inside
   `prompts/`).
5. **Phase 2**: fork the orchestrator with the curator brief (its own reflection
   plus the role summaries and the diff), wait (20 min), harvest.
6. **Report** to `~/.local/share/abstract/reflections/reflect-NNN.md`: per-role
   outcomes and summaries, curator review, full diff.
7. **Deliver** a steer synthetic to the live orchestrator session: headline
   stats, report path, and the instruction to present the proposals for
   ratification.

## The Gate Model

The self-amendment rule says propose before editing, but inside an unattended
fork there is nobody to approve a proposal. So the brief reframes honestly: the
/reflect invocation IS the owner's direct order, and the gate is afterward.
Doctrine edits land in the working tree directly (pre-approved RW, git-tracked),
and three reviews compound:

- the **curator fork** reviews the batch diff and issues per-edit verdicts
  (ratify | amend | revert, with reasons) as ADVICE, never edits on another
  role's behalf;
- the **live orchestrator** presents the report to the owner;
- the **owner ratifies**: what stays gets committed, what does not gets reverted
  (the orchestrator has curator scope to apply verdicts).

The curator recommends rather than amends so there is exactly one decision
point. Confidence discipline replaces the proposal ceremony: forks edit only
what they are confident about and defer everything else to the CURATOR list.

## The Briefs

Role fork: the gate reframe, the reflection questions (what recurred, what
failed, what was worked around or forgotten), the fence (own binder files, own
binder.yaml entry, reference directory; no project files, no experiments, no
tickets or memos; cue unavailable), and the closing format: CHANGED / CONSIDERED
/ CURATOR, at most five lines each. The CONSIDERED list is the tuning signal for
future briefs.

Curator fork: same frame and fence for its own reflection (it may edit its own
binder), then OWN / REVIEW / CURATOR CALLS / CONFLICTS over the batch diff and
the harvested summaries.

## Deferred

- **Auto-triggering.** Cadence automation only after batches prove their value.
  The semi-auto shape (owner types /reflect) is the point.
- **Generation-aware cue** (a communicating reflection swarm). The curator pass
  absorbs what communication would settle; build it only if forks are observed
  stuck needing peers.
- **Mechanical side-effect containment** for project files. The brief fences
  notes/, draft/, and friends in prose; notes are unversioned, so the first
  observed violation earns a deny-ruleset variant of the role agents for
  reflection sessions.
- **Fork cleanup.** Batches keep their forks for TUI inspection; a cleanup
  command can come when clutter actually bothers.
