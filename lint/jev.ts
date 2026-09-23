/**
 * jev.ts -- the Jev client behind abstract lint.
 *
 * One systemOne call per block: state is { text, section, role } for
 * document blocks, or just { text } for a bare prose passage (the prose
 * route passes no invented section; applicability rides on the lesson
 * wording). Questions are one noul per rule, keyed by rules.yaml entry id.
 * A rule's instruction is its entry's lesson (or judgement) verbatim; the
 * shared criteria pin the semantics for every rule: true is a violation,
 * false is fine or not applicable. A small pool keeps concurrent calls in
 * flight.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TypeSafeClient, noul } from "@typesafe-ai/sdk";
import { parse as parseYaml } from "yaml";
import type { Block } from "./scan.ts";

export interface Rule {
  id: number;
  text: string;
}

type Entry = { lesson?: string; judgement?: string };

/** Shared criteria: the same outcome semantics for every rule. */
const CRITERIA = {
  true: "The paragraph violates the rule.",
  false: "The paragraph is fine, or the rule does not apply to it.",
} as const;

/** Concurrent systemOne calls in flight. */
const CONCURRENCY = 4;

export function loadRules(editsPath: string): Rule[] {
  const doc = parseYaml(readFileSync(editsPath, "utf8")) as Record<
    string,
    Entry
  >;
  return Object.entries(doc)
    .map(([key, entry]) => {
      const text = (entry.lesson ?? entry.judgement ?? "").trim();
      if (!text)
        throw new Error(
          `rules.yaml entry ${key} has neither lesson nor judgement`,
        );
      return { id: Number(key), text };
    })
    .sort((a, b) => a.id - b.id);
}

/**
 * Our .env names the key TYPESAFEAI_API_KEY; the SDK default env is
 * TYPESAFE_API_KEY, so ours is read explicitly and passed in. Bun
 * auto-loads .env from the cwd; the harness .env covers runs elsewhere.
 */
function apiKey(harnessDir: string): string {
  const fromFile = (): string | undefined => {
    try {
      for (const l of readFileSync(join(harnessDir, ".env"), "utf8").split(
        "\n",
      )) {
        const m = l.match(/^(\w+)=(.*)$/);
        if (m && m[1] === "TYPESAFEAI_API_KEY")
          return m[2].trim().replace(/^["']|["']$/g, "");
      }
    } catch {}
    return undefined;
  };
  const key = process.env.TYPESAFEAI_API_KEY ?? fromFile();
  if (!key)
    throw new Error(
      "TYPESAFEAI_API_KEY is not set (process env or the harness .env)",
    );
  return key;
}

export function makeClient(harnessDir: string): TypeSafeClient {
  return new TypeSafeClient({ apiKey: apiKey(harnessDir) });
}

export interface Hit {
  rule: Rule;
  /** Probability the paragraph violates the rule. */
  p: number;
}

export interface BlockReport {
  block: Block;
  hits: Hit[];
}

export async function lintBlocks(
  client: TypeSafeClient,
  blocks: Block[],
  rules: Rule[],
  threshold: number,
  onProgress?: (done: number, total: number) => void,
): Promise<BlockReport[]> {
  const questions: Record<string, ReturnType<typeof noul>> = {};
  for (const rule of rules)
    questions[String(rule.id)] = noul(rule.text, CRITERIA);

  const reports = new Array<BlockReport>(blocks.length);
  let next = 0;
  let done = 0;

  const worker = async (): Promise<void> => {
    while (next < blocks.length) {
      const index = next++;
      const block = blocks[index];
      // A bare prose passage has no document around it: no invented section.
      const state: Record<string, unknown> = { text: block.text };
      if (block.section !== undefined) state.section = block.section;
      if (block.role !== undefined) state.role = block.role;
      const { answers } = await client.systemOne({
        state,
        questions,
      });
      const hits: Hit[] = [];
      for (const rule of rules) {
        const p = answers[String(rule.id)]?.noul;
        if (p !== undefined && p >= threshold) hits.push({ rule, p });
      }
      hits.sort((a, b) => b.p - a.p);
      reports[index] = { block, hits };
      onProgress?.(++done, blocks.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, blocks.length) }, worker),
  );
  return reports;
}
