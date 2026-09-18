#!/usr/bin/env bun
/**
 * First-author QC census (adopted owner rule, 2026-09-17): drop each first
 * author's earliest arXiv preprint. This script OWNS the pinned name
 * normalization; it is the census of record -- rerun it rather than
 * approximating it. Emits qc-firstauthor.jsonl (one row per arXiv paper:
 * doi_id, key, action keep|drop) consumed by the D1 train_include apply
 * and by training-set assembly. Non-arXiv families are out of scope
 * (flag defaults to keep at the D1 layer).
 *
 * Pinned normalization: NFKD + drop combining marks; strip name suffixes
 * {jr,sr,ii,iii,iv}; tokens split on non-letters; key = (lastname-lower,
 * first-initial-lower); single-token names key (token, ''); empty author
 * lists are kept with key null. Earliest = min(created, then arxiv_id).
 */
import * as fs from "node:fs";
const DIR = new URL("../.cache/bulk/arxiv/", import.meta.url).pathname.replace(
  /\/$/,
  "",
);

const SUFFIX = new Set(["jr", "sr", "ii", "iii", "iv"]);
const fold = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

function firstAuthorKey(authors: string[]): [string, string] | null {
  if (!authors?.length) return null;
  const toks = fold(authors[0])
    .replace(/[^A-Za-z]+/g, " ")
    .split(" ")
    .filter((t) => t && !SUFFIX.has(t.toLowerCase()));
  if (!toks.length) return null;
  if (toks.length === 1) return [toks[0].toLowerCase(), ""];
  return [toks[toks.length - 1].toLowerCase(), toks[0][0].toLowerCase()];
}

const rows = fs
  .readFileSync(`${DIR}/metadata.jsonl`, "utf8")
  .split("\n")
  .filter(Boolean)
  .map(
    (l) =>
      JSON.parse(l) as {
        doi: string;
        arxiv_id: string;
        authors: string[];
        created?: string;
      },
  );

type Ent = {
  doi_id: string;
  key: [string, string] | null;
  created: string;
  arxiv_id: string;
};
const byKey = new Map<string, Ent[]>();
const ents: Ent[] = rows.map((r) => ({
  doi_id: r.doi.toLowerCase().replace(/\//g, ":"),
  key: firstAuthorKey(r.authors),
  created: r.created ?? "9999",
  arxiv_id: r.arxiv_id,
}));
for (const e of ents) {
  if (!e.key) continue;
  const k = e.key.join("|");
  const list = byKey.get(k) ?? [];
  list.push(e);
  byKey.set(k, list);
}

// earliest per key: min (created, arxiv_id); tie broken deterministically
const drop = new Set<string>();
for (const list of byKey.values()) {
  list.sort((a, b) =>
    a.created === b.created
      ? a.arxiv_id < b.arxiv_id
        ? -1
        : 1
      : a.created < b.created
        ? -1
        : 1,
  );
  drop.add(list[0].doi_id);
}

const out = ents.map((e) => ({
  doi_id: e.doi_id,
  key: e.key ? e.key.join("|") : null,
  created: e.created,
  action: drop.has(e.doi_id) ? "drop" : "keep",
}));
fs.writeFileSync(
  `${DIR}/qc-firstauthor.jsonl`,
  out.map((r) => JSON.stringify(r)).join("\n") + "\n",
);

const keys = byKey.size;
const dropped = out.filter((r) => r.action === "drop").length;
const kept = out.length - dropped;
const noauth = out.filter((r) => r.key === null).length;
const sizes = new Map<string, number>();
for (const e of ents) {
  if (!e.key) continue;
  const k = e.key.join("|");
  sizes.set(k, (sizes.get(k) ?? 0) + 1);
}
const onetimers = [...sizes.values()].filter((n) => n === 1).length;
console.log(
  JSON.stringify(
    {
      papers: out.length,
      unique_first_author_keys: keys,
      dropped,
      kept,
      no_author_rows_kept: noauth,
      one_timer_keys: onetimers,
      one_timer_share_of_keys: +(100 * (onetimers / keys)).toFixed(1),
    },
    null,
    1,
  ),
);
