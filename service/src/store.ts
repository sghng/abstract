/**
 * The artifact store: everything fetched lives under service/data,
 * gitignored, one artifact per DOI. Files: <id>.pdf, <id>.txt (pages
 * separated by form feeds), <id>.meta.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DATA = path.resolve(import.meta.dir, "..", "data");
export const ARTIFACTS = path.join(DATA, "artifacts");
export const PROFILE = path.join(DATA, "profile");
export const LOGS = path.join(DATA, "logs");
for (const d of [ARTIFACTS, PROFILE, LOGS]) mkdirSync(d, { recursive: true });

export function doiToId(doi: string): string {
  return doi.replace(/\//g, "_");
}

export function validArtifact(id: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(id);
}

export function artPath(id: string, ext: "pdf" | "txt" | "meta.json"): string {
  if (!validArtifact(id)) throw new Error(`bad artifact id: ${id}`);
  return path.join(ARTIFACTS, `${id}.${ext}`);
}

export type ArtifactMeta = {
  doi: string;
  title?: string;
  journal?: string;
  route?: string;
  pages?: number;
  bytes?: number;
  fetched_at?: string;
  complete?: boolean;
  error?: { code: string; message: string; at: string };
};

export function readMeta(id: string): ArtifactMeta | null {
  const p = artPath(id, "meta.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function writeMeta(id: string, meta: ArtifactMeta): void {
  writeFileSync(artPath(id, "meta.json"), JSON.stringify(meta, null, 1));
}
