/**
 * The audit log: one JSONL line per fetch attempt, in the same spirit
 * as the Zotero reading channel (auditable access, abuse visible).
 */
import { appendFileSync } from "node:fs";
import { LOGS } from "./store.ts";

export function audit(entry: Record<string, unknown>): void {
  appendFileSync(
    `${LOGS}/audit.jsonl`,
    JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n",
  );
}
