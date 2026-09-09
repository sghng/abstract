#!/usr/bin/env bun
/**
 * Pipeline stage: resolve equation-image placeholders (@@eqNNNN@@ in
 * jem/md) to TeX.
 *
 * Sources: D1 assets rows (kind=equation) map (doi, eqNNNN) -> publisher
 * URL (PNG for the 2020-21 era, GIF for the 2005-era XML). Images are
 * Cloudflare-walled: downloads ride the persistent Chromium profile
 * (.cache/cf-profile, cleared once by a human via auth-chromium.ts),
 * first through the context's request API (cookie + clearance UA), then
 * falling back to a real page fetch. GIFs convert to PNG (sips) before
 * OCR. OCR: DeepSeek API, model deepseek-v4-flash-vision-exp.
 *
 * Splice policy: a token alone on its line becomes display math
 * ($$...$$), otherwise inline ($...$). Results are sanity-checked (no
 * refusals, no fences, sane length); failures keep the placeholder and
 * land in the report (fail-open). Each paper's md is rewritten only
 * after every one of its tokens has a state entry, so the run is
 * resumable per equation and never leaves a paper half-spliced.
 *
 * Usage:
 *   bun src/img2latex.ts --download-only      cache all images
 *   bun src/img2latex.ts --sample 30          end-to-end on 30 random
 *                                             equations, report for
 *                                             eyeballing (the gate)
 *   bun src/img2latex.ts                      full run
 */
import { readdir, writeFile, readFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
import { chromium } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const MD_DIR = `${ROOT}/jem/md`;
const IMG_DIR = `${ROOT}/.cache/eqimg`;
const PROFILE = `${ROOT}/.cache/cf-profile`;
const STATE = `${ROOT}/.cache/img2latex-state.json`;
const REPORT = `${ROOT}/.cache/img2latex-report.json`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";
const MODEL = "deepseek-v4-flash-vision-exp";
const TOKEN_RE = /@@(eq\d+)@@/g;

const DOWNLOAD_ONLY = process.argv.includes("--download-only");
const BUILD_MAPS = process.argv.includes("--build-srcmaps");
const dlMisses: Record<string, string> = {};
const SRCMAP_DIR = `${ROOT}/.cache/eqsrcmap`;
const SAMPLE = process.argv.includes("--sample")
  ? parseInt(process.argv[process.argv.indexOf("--sample") + 1])
  : 0;

const key = (doiId: string, handle: string) => `${doiId}:${handle}`;

async function d1(sql: string): Promise<any[]> {
  const proc = Bun.spawn(
    ["npx", "wrangler", "d1", "execute", "repertoire", "--remote", "--json", "--command", sql],
    { stdout: "pipe", stderr: "pipe" },
  );
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return JSON.parse(out)[0]?.results ?? [];
}

const esc = (s: string) => s.replace(/'/g, "''");

// ---- collect the work -----------------------------------------------

interface Eq {
  doiId: string;
  handle: string;
  url: string;
  mdFile: string;
  display: boolean; // token alone on its line
}

async function collect(): Promise<Eq[]> {
  const urls = new Map<string, string>();
  for (const r of await d1(
    `select doi, handle, url from assets where kind='equation' and url is not null`,
  )) {
    urls.set(key(r.doi.replace("/", ":"), r.handle), r.url);
  }
  const eqs: Eq[] = [];
  let rewritten = 0;
  for (const f of (await readdir(MD_DIR)).filter((f) => f.endsWith(".md")).sort()) {
    const doiId = f.slice(0, -3);
    const md = await Bun.file(`${MD_DIR}/${f}`).text();
    const tokens = [...md.matchAll(TOKEN_RE)].map((m) => m[1]);
    if (!tokens.length) continue;
    // rewrite dead /doi/-form graphic URLs to the live /cms/asset/ form:
    // from the lean html srcs when the paper has one, else from the
    // cached live-page src map (--build-srcmaps)
    const srcMap = new Map<string, string>();
    const htmlPath = `${ROOT}/jem/html/${f.replace(/\.md$/, ".html")}`;
    const html = await Bun.file(htmlPath).text().catch(() => null);
    const srcs = html
      ? [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1])
      : Object.values(
          JSON.parse(
            (await Bun.file(`${SRCMAP_DIR}/${doiId}.json`).text().catch(() => "{}")) as any,
          ),
        );
    for (const s of srcs) {
      const name = s.split("/").pop()!.split("?")[0];
      if (!srcMap.has(name)) srcMap.set(name, s);
    }
    const seen = new Set<string>();
    for (const handle of tokens) {
      if (seen.has(handle)) continue;
      seen.add(handle);
      let url = urls.get(key(doiId, handle));
      if (!url) continue;
      if (url.includes("/doi/")) {
        const name = url.split("/").pop()!;
        const live = srcMap.get(name);
        if (live) {
          url = live.startsWith("http") ? live : `https://onlinelibrary.wiley.com${live}`;
          rewritten++;
        }
      }
      const display = new RegExp(`^\\s*@@${handle}@@\\s*$`, "m").test(md);
      eqs.push({ doiId, handle, url, mdFile: f, display });
    }
  }
  console.log(`${rewritten} urls rewritten from live html srcs`);
  return eqs;
}

// ---- source maps (current asset urls live only on the article pages) ---

async function buildSrcMaps(ctx: any) {
  await mkdir(SRCMAP_DIR, { recursive: true });
  const papers: string[] = [];
  for (const f of (await readdir(MD_DIR)).filter((f) => f.endsWith(".md")).sort()) {
    const doiId = f.slice(0, -3);
    const md = await Bun.file(`${MD_DIR}/${f}`).text();
    if (!/@@eq\d+@@/.test(md)) continue;
    if (await Bun.file(`${ROOT}/jem/html/${f.replace(/\.md$/, ".html")}`).exists()) continue;
    if (await Bun.file(`${SRCMAP_DIR}/${doiId}.json`).exists()) continue;
    papers.push(doiId);
  }
  console.log(`${papers.length} papers need live-page src maps`);
  const queue = [...papers];
  let n = 0;
  const worker = async () => {
    const page = await ctx.newPage();
    while (queue.length) {
      const doiId = queue.shift()!;
      const doi = doiId.replace(":", "/");
      try {
        const r = await page.goto(`https://onlinelibrary.wiley.com/doi/${doi}`, {
          waitUntil: "domcontentloaded",
          timeout: 40_000,
        });
        if (!r?.ok()) throw new Error(`http ${r?.status()}`);
        await page.waitForTimeout(2500);
        const srcs = await page.evaluate(() =>
          [...document.images]
            .map((i) => i.currentSrc || i.src)
            .filter(Boolean),
        );
        const map: Record<string, string> = {};
        for (const s of srcs) {
          const name = s.split("/").pop()!.split("?")[0];
          if (!map[name]) map[name] = s;
        }
        await Bun.write(`${SRCMAP_DIR}/${doiId}.json`, JSON.stringify(map, null, 1));
      } catch (e: any) {
        console.log(`MAP FAIL ${doiId}: ${String(e.message).split("\n")[0]}`);
      }
      if (++n % 20 === 0) console.log(`${n}/${papers.length}`);
    }
    await page.close().catch(() => {});
  };
  await Promise.all(Array.from({ length: 3 }, worker));
}

// ---- download ---------------------------------------------------------

async function imgPath(e: Eq): Promise<string> {
  // cached converted png first, then raw
  const png = `${IMG_DIR}/${key(e.doiId, e.handle)}.png`;
  const raw = `${IMG_DIR}/${key(e.doiId, e.handle)}${e.url.match(/\.(\w+)(\?|$)/)?.[1] ? "." + e.url.match(/\.(\w+)(\?|$)/)![1] : ".img"}`;
  if (await Bun.file(png).exists()) return png;
  if (await Bun.file(raw).exists()) return raw;
  return raw;
}

async function downloadAll(ctx: any, eqs: Eq[]) {
  await mkdir(IMG_DIR, { recursive: true });
  // PNG era first (bulk, live), dead/hanging GIF era last
  const png = eqs.filter((e) => e.url.endsWith(".png"));
  const gif = eqs.filter((e) => !e.url.endsWith(".png"));
  const queue = [...png, ...gif].filter(
    async (e) => !(await Bun.file(await imgPath(e)).exists()) && !dlMisses[key(e.doiId, e.handle)],
  );
  console.log(`downloading ${queue.length} images (${png.length} png, ${gif.length} graphic-era)`);
  let n = 0;
  const worker = async () => {
    // real page navigation: the request API is TLS-fingerprinted out by
    // Cloudflare; a Chromium navigation carries clearance cookies AND
    // the browser's TLS stack. A burst of consecutive failures means the
    // clearance went stale: end the worker instead of retrying 20K times.
    const page = await ctx.newPage();
    let consecutiveFails = 0;
    while (queue.length) {
      const e = queue.shift()!;
      const ext = e.url.match(/\.(\w+)(\?|$)/)?.[1] ?? "img";
      const raw = `${IMG_DIR}/${key(e.doiId, e.handle)}.${ext}`;
      try {
        const isGif = e.url.endsWith(".gif");
        // domcontentloaded: a managed challenge (if shown) auto-solves
        // before it fires; "commit" snapshots the challenge page instead
        const r = await page.goto(e.url, {
          waitUntil: "domcontentloaded",
          timeout: isGif ? 20_000 : 30_000,
        });
        let buf: Buffer | undefined = r?.ok() ? await r.body() : undefined;
        if (!buf || !r?.ok()) {
          // challenge page or soft failure: re-fetch in-page (browser
          // TLS + cookies), base64 across the bridge
          await page.waitForTimeout(4000);
          const b64 = await page.evaluate(async (u: string) => {
            const resp = await fetch(u);
            if (!resp.ok) return null;
            const blob = await resp.blob();
            if (!blob.type.startsWith("image/")) return null;
            return await blobToB64(blob);
            async function blobToB64(b: Blob) {
              const ab = await b.arrayBuffer();
              let s = "";
              const bytes = new Uint8Array(ab);
              for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
              return btoa(s);
            }
          }, e.url);
          if (b64) buf = Buffer.from(b64, "base64");
        }
        if (!buf || buf.length < 100) throw new Error(`no body (${buf?.length ?? 0}B)`);
        await Bun.write(raw, buf);
        if (ext === "gif") {
          await run("sips", ["-s", "format", "png", raw, "--out", `${IMG_DIR}/${key(e.doiId, e.handle)}.png`]);
        }
      } catch (e2: any) {
        const msg = String(e2.message).split("\n")[0];
        console.log(`DL FAIL ${key(e.doiId, e.handle)}: ${msg}`);
        if (/http 40[4]|http 41[05]|Timeout/.test(msg)) {
          // permanently gone (or hanging challenge): record and move on
          dlMisses[key(e.doiId, e.handle)] = msg;
          continue;
        }
        if (/http 40[3]/.test(msg) && ++consecutiveFails >= 3) {
          await page.close().catch(() => {});
          return; // clearance stale: stop this worker
        }
        if (++consecutiveFails >= 8) {
          await page.close().catch(() => {});
          return;
        }
      }
      if (n % 100 === 1) consecutiveFails = 0;
      if (++n % 100 === 0) console.log(`${n}/${queue.length + n}`);
    }
    await page.close().catch(() => {});
  };  await Promise.all(Array.from({ length: 6 }, worker));
}

// ---- OCR --------------------------------------------------------------

async function ocr(path: string): Promise<string> {
  const b64 = Buffer.from(await readFile(path)).toString("base64");
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${b64}` },
            },
            {
              type: "text",
              text:
                "Transcribe the equation in this image as LaTeX. " +
                "Reply with ONLY the LaTeX source, no $ delimiters, " +
                "no markdown fences, no commentary.",
            },
          ],
        },
      ],
      max_tokens: 700,
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`api ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const j = await res.json();
  let tex = (j.choices?.[0]?.message?.content ?? "").trim();
  tex = tex.replace(/^```(?:latex|tex)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (/^(i can|i'm sorry|sorry|unable|as an ai)/i.test(tex)) throw new Error("refusal");
  if (tex.length < 1 || tex.length > 1800) throw new Error(`suspicious length ${tex.length}`);
  if (tex.includes("$$")) tex = tex.replaceAll("$$", "");
  return tex;
}

// ---- main -------------------------------------------------------------

const main = async () => {
  await mkdir(IMG_DIR, { recursive: true });
  const state: Record<string, string> = JSON.parse(
    (await readFile(STATE).catch(() => "{}")) as any,
  );
  let eqs = await collect();
  console.log(`${eqs.length} distinct equations with asset rows`);

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, // clearance is bound to the headed UA/TLS profile
    viewport: { width: 1280, height: 900 },
  });

  try {
    if (BUILD_MAPS) {
      await buildSrcMaps(ctx);
      await ctx.close();
      return;
    }
    await downloadAll(ctx, eqs);
    if (DOWNLOAD_ONLY) {
      await ctx.close();
      return;
    }

    let targets = eqs.filter((e) => !state[key(e.doiId, e.handle)]);
    if (SAMPLE) {
      // random sample across eras for the eyeball gate
      targets = [...eqs]
        .sort(() => Math.random() - 0.5)
        .filter((e) => state[key(e.doiId, e.handle)] === undefined)
        .slice(0, SAMPLE);
    }
    console.log(`OCR on ${targets.length} equations`);

    const report: any = {};
    let n = 0;
    const queue = [...targets];
    const worker = async () => {
      while (queue.length) {
        const e = queue.shift()!;
        const k = key(e.doiId, e.handle);
        try {
          const p = await imgPath(e);
          if (!(await Bun.file(p).exists())) throw new Error("image missing");
          const tex = await ocr(p);
          state[k] = "ok";
          report[k] = { tex, display: e.display, url: e.url, img: p };
        } catch (e2: any) {
          state[k] = `fail:${e2.message.slice(0, 80)}`;
          report[k] = { error: e2.message.slice(0, 200), url: e.url, img: await imgPath(e) };
        }
        if (++n % 50 === 0) {
          console.log(`${n}/${targets.length}`);
          await writeFile(STATE, JSON.stringify(state, null, 1));
        }
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    await writeFile(STATE, JSON.stringify(state, null, 1));

    if (SAMPLE) {
      const out = Object.entries(report)
        .map(([k, r]: any) => `## ${k}\n<img:${r.img}>\n${r.tex ?? "ERROR: " + r.error}\n`)
        .join("\n");
      await writeFile(`${ROOT}/.cache/img2latex-sample.md`, out);
      console.log(`sample report -> .cache/img2latex-sample.md`);
      await ctx.close();
      return;
    }

    // splice: per paper, only when every token has a state entry
    let papers = 0;
    let spliced = 0;
    let kept = 0;
    for (const f of (await readdir(MD_DIR)).filter((f) => f.endsWith(".md")).sort()) {
      const doiId = f.slice(0, -3);
      const md = await Bun.file(`${MD_DIR}/${f}`).text();
      const handles = [...new Set([...md.matchAll(TOKEN_RE)].map((m) => m[1]))];
      if (!handles.length) continue;
      if (handles.some((h) => state[key(doiId, h)] === undefined)) continue; // not ready
      let out = md;
      for (const h of handles) {
        const k = key(doiId, h);
        if (state[k]?.startsWith("fail")) {
          kept++;
          continue;
        }
        // re-derive display-ness from the md (token alone on its line)
        const display = new RegExp(`^\\s*@@${h}@@\\s*$`, "m").test(out);
        // find the tex from this run's report or re-OCR (cheap: 1 call)
        const tex = report[k]?.tex ?? (await ocr(await reimgPath(doiId, h, eqs)));
        out = out.replaceAll(`@@${h}@@`, display ? `$$${tex}$$` : `$${tex}$`);
        spliced++;
      }
      await Bun.writeFile(`${MD_DIR}/${f}`, out);
      papers++;
    }
    await writeFile(REPORT, JSON.stringify(report, null, 1));
    console.log(`spliced ${spliced} equations in ${papers} papers; ${kept} kept as placeholders`);
    console.log(`report -> ${REPORT}`);
  } finally {
    await ctx.close();
  }
};

async function reimgPath(doiId: string, handle: string, eqs: Eq[]): Promise<string> {
  const e = eqs.find((x) => x.doiId === doiId && x.handle === handle)!;
  return imgPath(e);
}

main();
