# abstract-mcp service

The lab's own MCP service: paper fetch (DOI to page-anchored full
text) over the campus entitlement, later the repertoire query. Serves
streamable HTTP at `/mcp` on `127.0.0.1:4857`. MCP only; no REST face.

## Surface

| Tool | Meaning |
| --- | --- |
| `paper_search` | topic to ranked records from Semantic Scholar + OpenAlex, fused and deduped by DOI (reciprocal rank fusion); hits carry doi, year, venue, citations, OA; feeds `paper_fetch`. Grey literature is out of scope |
| `paper_resolve` | DOI to merged metadata (Crossref, OpenAlex, Unpaywall) plus route; cheap |
| `paper_fetch` | submit-and-poll fetch into the server-side store; states started, queued, ok, failed(code) |
| `paper_read` | page-anchored text range, the `read_pdf_pages` idiom |
| `paper_find` | phrase to page hits with snippets; hyphenation and whitespace normalized, all-words-per-page fallback (`mode` says which); the verification idiom |
| `paper_export` | base64 PDF, durable capture into `references/` only |

Error codes: `doi_not_registered` (reserved or typo; the jemd.70061
case), `publisher_missing` (DOI resolves, publisher 404s; the JEM
platform condition, route those to JSTOR or ILL), `not_entitled`,
`challenge_needs_human` (30 minute publisher cooldown after it),
`fetch_failed`.

## Routes and acceptance state

| Route | Mechanism | State |
| --- | --- | --- |
| open-access | OA pdf url from OpenAlex/Unpaywall, plain HTTP | verified (Psychometrika) |
| springer | plain HTTP `content/pdf` | implemented, pattern proven |
| cambridge | landing parse, plain HTTP pdf | verified |
| wiley | browser landing, then in-page `pdfdirect`; on 403, force a Cloudflare interstitial (headless UA), clear it (clean UA), retry | verified (EM:IP paywalled) |
| elsevier | PII from the redirect chain, browser funnel when blocked, navigate `pdfft` to the signed CDN url | implemented per the proven experiment; IP-level block (2026-10-13, outlasted 17 h and hit the MCP browser too), 24 h cooldown, re-verify pending; multagen egress is the fallback if it recurs |

The wiley clearance dance exists because a too-clean profile never
meets a challenge and so never earns the clearance cookie that
authorizes `pdfdirect`. Forcing the interstitial once replicates what
a patched session did naturally.

## Politeness

One publisher hit at a time through the serial queue (6 s minimum
interval plus jitter, `ABSTRACT_FETCH_INTERVAL`), 30 minute cooldown
after a human-challenge failure, one JSONL audit line per attempt in
`service/data/logs/audit.jsonl`. DOI-only input; never a URL proxy.
This pacing is what protects the institutional entitlement.

## Layout and running

`service/src` (Bun, TypeScript): `index.ts` serves through `node:http`
(the SDK transport wants Node req/res pairs), `mcp.ts` is stateless
per-request MCP with plain JSON Schema tools, `browser.ts` owns the
one persistent chromium context (full chromium, `channel: "chromium"`,
UA probed once and persisted, profile under `service/data/profile`),
`routes/` holds the publisher modules, `fetcher.ts` is the queue and
artifact writer, `text.ts` the reading tools (extraction is `pdftotext`
default reading order; `-layout` interleaved columns and was removed
2026-10-13 after phrase recall measured 43% against 100%). Artifacts live under
`service/data/artifacts` (gitignored): `<id>.pdf`, `<id>.txt` (pages
split by form feeds), `<id>.meta.json`.

Run by hand: `bun service/src/index.ts`. In production a systemd
user unit (`~/.config/systemd/user/abstract-mcp.service`, pattern of
`zotero-mcp`; unit files live on the host, never in the repo), with
EnvironmentFile `~/.config/abstract-mcp/env` (`ABSTRACT_PORT`,
`ABSTRACT_HOST`, `ABSTRACT_TOKEN` optional bearer, `ABSTRACT_UPEMAIL`;
for `paper_search`, optional `S2_API_KEYS` (comma-separated free keys,
rotated round-robin per call and per retry; each key is 1 req/s and
Ai2 prunes keys idle ~60 days, so rotation shares the budget and keeps
every key warm; supersedes single-key `S2_API_KEY`) and
`OPENALEX_API_KEY` (free, $1/day usage budget; keyless works at
$0.10/day and DOI singleton lookups stay free).
Without keys both legs still run on their shared/keyless pools.
Ingress is Caddy at `https://abstract.sgh.ng/mcp` (`/mcp*` path
convention, DNS-01); the name resolves via the unbound-back local-data
line `abstract.sgh.ng -> centurion.sgh.ng`.

Known limitation: one browser per profile directory; the smoke script
and the service cannot run a fetch at the same time.

Elsevier cooldown recheck: `service/recheck.ts` behind a host-side
user timer (6 h cadence, self-guarded to
at most one real attempt per 24 h cooldown cycle); outcomes append to
`service/data/logs/elsevier-recheck.jsonl`. Disable the timer once a
run reports ok.

## Roadmap

The repertoire query lands behind this service; the D1 span rebuild that
gated it landed 2026-10-16 (docs/repertoire). Skills and the project
template gain their invocation lines only as proposed text (kernel rule).
