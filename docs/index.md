# abstract manual

Two bodies of documentation live here. The site is local-only
(`bun run docs:dev`, never deployed).

## [Repertoire manual](/repertoire/)

The convention corpus: what it is, how each layer works, and the recipes for
the next collection round. Start at the [overview + spec](/repertoire/); round
work goes through [fetch](/repertoire/fetch) and [parse](/repertoire/parse);
the [parse report](/repertoire/parse-report) is the failure/quality ledger;
[history](/repertoire/history) records the build arc and the superseded
proposals.

## Design + explorations

[typ2docx](/typ2docx) is the Word converter's contract (float policy,
measurement discipline, Word versus LibreOffice divergences). Dated design
explorations are kept as history: [prompting (2026-10-11)](/prompting-2026-10-11)
surveys Anthropic, OpenAI, and community skill publishers and records the
judgments behind the skills-model restructure. [Stylometer](/stylometer) and
the [q-matrix session audit](/session-audit-qmatrix-rnr) are historical
records. The harness-era docs (multi-agent, harness, desk, reflection, remote
access, and friends) were deleted with the harness; git history and the `v1`
tag preserve them.
