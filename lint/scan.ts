/**
 * scan.ts -- the Typst source scanner behind abstract lint.
 *
 * The contract any parser must satisfy is the Block: a paragraph-sized run
 * with its text (kept lines verbatim), its line range, the H1 section it
 * lives under, and a role (abstract, list, or body). A swap to a pandoc
 * round trip or typst query changes only this file.
 *
 * v1 scanner, homegrown per the provisional sketch: blank-line blocks over
 * the raw source. Headings update the section (H1 only) and never join a
 * block. Comments, label-only lines, code invocations (#figure, #footnote,
 * #show, ...; a multi-line call continues while brackets stay unbalanced),
 * fenced raw blocks, and display math are skipped in place. Two bracketed
 * prose containers are captured whole instead of skipped: #let abstract
 * [...] as role abstract, and #highlight [...] (revision marking) as body
 * blocks under the current section; a capture holding several blank-line
 * paragraphs yields one block per paragraph. An H1 named Abstract also
 * yields the abstract role, so both template generations agree. List runs
 * (bullets, terms, enums, with indented continuations) stay whole as role
 * list. What survives under MIN_CHARS characters is not a paragraph and is
 * dropped.
 */

export type Role = "abstract" | "list" | "body";

export interface Block {
  /** Kept lines verbatim, newline-joined. */
  text: string;
  /** 1-based source line of the first kept line. */
  start: number;
  /** 1-based source line of the last kept line. */
  end: number;
  /** Current H1 title ("" before the first H1, "abstract" for the abstract). */
  section: string;
  role: Role;
}

/** Blocks under this many characters are not paragraphs. */
const MIN_CHARS = 30;

/** Heading at column zero: = H1, == H2, and deeper. */
const HEADING = /^(=+)\s*(.*)$/;

/** List item markers: bullet, enum, numbered enum, term. */
const LIST_ITEM = /^(?:[-+]\s|\d+\.\s|\/\s)/;

/** Standalone label line, e.g. <introduction>. */
const LABEL = /^<[^<>]+>$/;

/** Net bracket depth of a line, ignoring quoted and raw strings. */
function depth(s: string): number {
  const clean = s
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
  let d = 0;
  for (const ch of clean) {
    if ("([{".includes(ch)) d++;
    else if (")]}".includes(ch)) d--;
  }
  return d;
}

/** Strip the longest common leading whitespace from nonblank lines. */
function dedent(lines: string[]): string[] {
  const widths = lines
    .filter((l) => l.trim())
    .map((l) => l.match(/^ */)![0].length);
  if (!widths.length) return lines;
  const n = Math.min(...widths);
  return lines.map((l) => (l.trim() ? l.slice(n) : ""));
}

/** An H1 title with any trailing label stripped. */
function h1Title(rest: string): string {
  const m = rest.match(/^#\s*strong\[(.*)\]$/); // pandoc bolds heading text
  return (m ? m[1] : rest).replace(/<[^>]*>\s*$/, "").trim();
}

/** A line closes display math when it ends with $ (any trailing punctuation
 *  after the closing delimiter is markup, e.g. the comma in "$ x $,"). */
const CLOSES_MATH = /\$\s*[,.:;!?]*$/;

/** Index of the line closing the display math opened at lines[j]. */
function mathEnd(lines: string[], j: number): number {
  const open = lines[j].trim();
  if (open !== "$" && CLOSES_MATH.test(open)) return j;
  for (let k = j + 1; k < lines.length; k++) {
    const t = lines[k].trim();
    if (t === "$" || CLOSES_MATH.test(t)) return k;
  }
  return lines.length - 1;
}

export function scan(source: string): Block[] {
  const lines = source.split("\n");
  const blocks: Block[] = [];
  let section = "";

  let kept: string[] = [];
  let start = 0;
  let end = 0;
  let role: Role = "body";

  const push = (line: string, ln: number): void => {
    if (!kept.length) start = ln;
    kept.push(line);
    end = ln;
  };

  /** Reference entries are not prose; the references section is not linted. */
  const emit = (text: string, start: number, end: number, at: Role): void => {
    if (/^(references|bibliography)$/i.test(section)) return;
    if (text.trim().length < MIN_CHARS) return;
    const r =
      at === "body" && section.toLowerCase() === "abstract" ? "abstract" : at;
    blocks.push({
      text,
      start,
      end,
      section: r === "abstract" ? "abstract" : section,
      role: r,
    });
  };

  const flush = (): void => {
    if (!kept.length) return;
    emit(kept.join("\n"), start, end, role);
    kept = [];
  };

  /**
   * Capture the bracketed content of a prose container opening at lines[i]
   * (a #let abstract or #highlight declaration). Runs the same in-place
   * skip rules as the main loop, splits on blank lines, and emits each
   * surviving paragraph as a block of the given role. Returns the index of
   * the first line after the container.
   */
  const capture = (i: number, roleAt: Role): number => {
    const open = lines[i].indexOf("[");
    let d = depth(lines[i].slice(open));

    const pieces: { text: string; first: number; last: number }[] = [];
    let piece: string[] = [];
    let first = 0;
    let last = 0;
    const piecePush = (text: string, ln: number): void => {
      if (!piece.length) first = ln;
      piece.push(text);
      last = ln;
    };
    const pieceEnd = (): void => {
      if (piece.length) pieces.push({ text: piece.join("\n"), first, last });
      piece = [];
    };

    // Content on the opening line, after the bracket.
    const head = lines[i].slice(open + 1).replace(/\][\s\S]*$/, "");
    if (head.trim()) piecePush(head, i + 1);

    let j = i + 1;
    while (j < lines.length && d > 0) {
      const cl = lines[j];
      const line = cl.trim();
      const dd = depth(cl);

      // The container's closing bracket: keep what precedes it, stop.
      if (dd < 0 && d + dd <= 0) {
        const before = cl.replace(/\][\s\S]*$/, "");
        if (before.trim()) piecePush(before, j + 1);
        j++;
        break;
      }

      if (!line) pieceEnd();
      else if (line.startsWith("//") || LABEL.test(line)) {
        // skipped in place
      } else if (line.startsWith("```")) {
        // Fenced raw block inside the content: skip to the closing fence.
        do j++;
        while (j < lines.length && !lines[j].trim().startsWith("```"));
      } else if (HEADING.test(line)) {
        // Captured content is indented; headings inside it are structural.
        const h = line.match(HEADING)!;
        if (h[1].length === 1) section = h1Title(h[2]);
      } else if (line === "$" || line.startsWith("$ ")) {
        j = mathEnd(lines, j);
      } else if (line.startsWith("#")) {
        // Code invocation inside the content: skip its span. Only the
        // span's net bracket depth touches the container's balance (the
        // opening line's depth is consumed by the walk, not added here).
        let cd = dd;
        while (cd > 0 && j + 1 < lines.length) cd += depth(lines[++j]);
        d += cd;
      } else {
        d += dd;
        piecePush(cl, j + 1);
      }
      j++;
    }
    pieceEnd();

    for (const p of pieces) {
      const text = dedent(p.text.split("\n")).join("\n").trim();
      emit(text, p.first, p.last, roleAt);
    }
    return j;
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    const ln = i + 1;

    // Blank lines end the current block.
    if (!line) {
      flush();
      i++;
      continue;
    }

    // Fenced raw block: skip to the closing fence.
    if (line.startsWith("```")) {
      flush();
      do i++;
      while (i < lines.length && !lines[i].trim().startsWith("```"));
      i++;
      continue;
    }

    // Headings update the section (H1 only) and never join a block.
    const h = raw.match(HEADING);
    if (h) {
      flush();
      if (h[1].length === 1) section = h1Title(h[2]);
      i++;
      continue;
    }

    // Comment and label-only lines drop in place; the block around them
    // continues.
    if (line.startsWith("//") || LABEL.test(line)) {
      i++;
      continue;
    }

    // A line that is only a bold span is a pseudo-heading (Word artifact):
    // it updates the section and never joins a block.
    const psh = line.match(/^#\s*strong\[(.*)\]$/);
    if (psh) {
      flush();
      section = h1Title(psh[1]);
      i++;
      continue;
    }

    // Display math ($ followed by space, or a lone $) is a paragraph of
    // its own; skip to its closing line.
    if (line === "$" || line.startsWith("$ ")) {
      flush();
      i = mathEnd(lines, i) + 1;
      continue;
    }

    // Bracketed prose containers are captured, not skipped.
    if (line.startsWith("#") && raw.includes("[")) {
      if (/^#\s*let\s+abstract\b/.test(line)) {
        flush();
        i = capture(i, "abstract");
        continue;
      }
      if (/^#\s*highlight\s*\[/.test(line)) {
        flush();
        i = capture(i, "body");
        continue;
      }
    }

    // Code invocations skip in place (an inline footnote leaves its
    // paragraph intact); a multi-line call continues while brackets stay
    // unbalanced.
    if (line.startsWith("#")) {
      let d = 0;
      do {
        d += depth(lines[i]);
        i++;
      } while (d > 0 && i < lines.length);
      continue;
    }

    // Prose and list runs. A list marker starts a list block; indented
    // lines continue one; anything else inside a list starts a new block.
    const isListItem = LIST_ITEM.test(line);
    if (!kept.length) {
      role = isListItem ? "list" : "body";
      push(raw, ln);
    } else if (role === "list") {
      if (isListItem || /^\s/.test(raw)) push(raw, ln);
      else {
        flush();
        role = "body";
        push(raw, ln);
      }
    } else {
      if (isListItem) {
        flush();
        role = "list";
      }
      push(raw, ln);
    }
    i++;
  }
  flush();
  return blocks;
}
