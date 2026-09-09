#!/usr/bin/env bun
/**
 * Pipeline stage: cleaned XML copies. Formats every pristine XML
 * (jem/xml, xml) into xml-clean/{doi_id}.xml -- the readable canonical
 * copy stored in the bucket alongside raw/.
 *
 * xmllint --format is UNSAFE here: Wiley XML carries significant spaces
 * as whitespace-only text nodes between elements
 * (`</givenNames> <familyName>` = "N. Tuma"), and libxml2's reindenter
 * drops exactly those (verified: 503/531 files lose spaces). This
 * formatter is structure-aware instead: an element whose children are all
 * elements + blank text (no mixed content) is reindented; any element
 * with non-blank text or comment children is serialized verbatim.
 * Conversion safety is proven by the MD gate (jemxml2md --xml-dir
 * xml-clean must produce byte-identical md).
 *
 * Resumable: skips files already present.
 * Usage: bun src/clean-xml.ts
 */
import { readdir, mkdir, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT_DIR = `${ROOT}/xml-clean`;
const SOURCES = [`${ROOT}/jem/xml`, `${ROOT}/xml`];

const PAD = "  ";

function formatXml(src: string): string {
  const $ = cheerio.load(src, { xmlMode: true }, false);
  const root = $.root()[0]?.children?.find((n: any) => n.type === "element");
  if (!root) return src;

  const serialize = (el: any, depth: number): string => {
    const children: any[] = el.children ?? [];
    const hasContent = children.some(
      (n) =>
        (n.type === "text" && n.data.trim() !== "") ||
        n.type === "comment" ||
        n.type === "cdata",
    );
    const hasElements = children.some((n) => n.type === "element");
    if (hasContent || !hasElements) {
      // mixed content or leaf: verbatim
      return $.html(el);
    }
    const pad = PAD.repeat(depth);
    const inner = children
      .filter((n) => n.type === "element")
      .map((n) => `${PAD}${pad}${serialize(n, depth + 1)}`)
      .join("\n");
    const open = $.html(el).match(/^<[^>]+>/)?.[0] ?? `<${el.name}>`;
    return `${open}\n${inner}\n${pad}</${el.name}>`;
  };

  const decl = src.match(/^<\?xml[^>]*\?>/)?.[0] ?? '<?xml version="1.0" encoding="UTF-8"?>';
  return `${decl}\n${serialize(root, 0)}\n`;
}

const main = async () => {
  await mkdir(OUT_DIR, { recursive: true });
  let n = 0;
  let skipped = 0;
  for (const dir of SOURCES) {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".xml"));
    for (const f of files) {
      const outPath = `${OUT_DIR}/${f}`;
      if (await Bun.file(outPath).exists()) {
        skipped++;
        continue;
      }
      const src = await Bun.file(`${dir}/${f}`).text();
      await writeFile(outPath, formatXml(src));
      if (++n % 100 === 0) console.log(`${n} formatted`);
    }
  }
  console.log(`formatted ${n}, skipped ${skipped}`);
};

main();
