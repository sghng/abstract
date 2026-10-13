/** pdfinfo / pdftotext wrappers over the system poppler utils. */

export function pdfPages(pdfPath: string): number {
  const r = Bun.spawnSync(["pdfinfo", pdfPath], { stdout: "pipe", stderr: "ignore" });
  const m = /Pages:\s+(\d+)/.exec(r.stdout.toString());
  if (!m) throw new Error("pdfinfo found no page count");
  return Number(m[1]);
}

export function pdfToText(pdfPath: string, txtPath: string): void {
  // no -layout: it preserves visual geometry and interleaves columns per
  // visual row, destroying reading order. Default mode keeps phrases
  // contiguous for paper_find (2026-10-13, recall 43% -> 100% on samples).
  const r = Bun.spawnSync(["pdftotext", pdfPath, txtPath], {
    stdout: "ignore",
    stderr: "pipe",
  });
  if (r.exitCode !== 0) throw new Error(`pdftotext failed: ${r.stderr.toString().slice(0, 200)}`);
}

export function isPdf(buf: Buffer): boolean {
  return buf.subarray(0, 4).toString("latin1") === "%PDF";
}
