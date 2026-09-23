//! abstract-extract -- the Typst paragraph extractor behind `abstract lint`.
//!
//! Parser-level only (typst-syntax, pinned to the lab's installed typst): a
//! sidecar, spawned by lint/scan.ts, that turns a .typ source into the Block
//! contract as JSON on stdout: an array of { text, start, end, section,
//! role }, where text is the kept source lines verbatim, start/end are
//! 1-based line numbers, section is the enclosing H1 title ("" before the
//! first H1, "abstract" for the abstract), and role is abstract | list |
//! body.
//!
//! Method: the syntax tree classifies each source line (blank, skipped in
//! place, flush-and-skip, prose, list item, structural heading), then a line
//! machine identical to the retired homegrown scanner assembles blocks:
//! blank lines end blocks, comments/labels/code skip in place, display math
//! and fenced raw skip and end blocks, H1s and lone #strong[..] lines
//! (pandoc pseudo-headings) set the section, #let abstract = [..] and
//! #highlight [..] are captured whole with their role, list runs stay whole,
//! and what survives MIN_CHARS is a block. The tree replaces the scanner's
//! regexes exactly where regexes guess: bracket balance, math closure, raw
//! fences, heading text. Prose sharing a line with skipped code stays
//! (the regex scanner dropped it).
//!
//! Dev mode: `--tree` dumps the parse tree instead of extracting.

use std::io::Read;
use std::ops::Range;

use typst_syntax::{parse, Lines, LinkedNode, SyntaxKind};

/** Blocks under this many characters are not paragraphs. */
const MIN_CHARS: usize = 30;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.iter().any(|a| a == "--version") {
        println!(
            "abstract-extract {} (typst-syntax 0.15.1)",
            env!("CARGO_PKG_VERSION")
        );
        return;
    }
    if args.iter().any(|a| a == "--tree") {
        let source = read_input(args.iter().find(|a| !a.starts_with("--")));
        let root = parse(&source);
        dump(&LinkedNode::new(&root), 0);
        return;
    }
    let source = read_input(args.first());
    print!("{}", to_json(&extract(&source)));
}

fn read_input(path: Option<&String>) -> String {
    match path {
        Some(p) => std::fs::read_to_string(p).unwrap_or_else(|e| {
            eprintln!("abstract-extract: {p}: {e}");
            std::process::exit(2);
        }),
        None => {
            let mut s = String::new();
            std::io::stdin()
                .read_to_string(&mut s)
                .expect("stdin utf-8");
            s
        }
    }
}

/* -- dev tree dump -------------------------------------------------------- */

fn dump(node: &LinkedNode, depth: usize) {
    let range = node.range();
    let text = node.get().full_text().to_string();
    let preview: String = text
        .split('\n')
        .next()
        .unwrap_or("")
        .chars()
        .take(66)
        .collect();
    println!(
        "{}{:?}  {}..{}  |{}",
        "  ".repeat(depth),
        node.kind(),
        range.start,
        range.end,
        preview
    );
    for child in node.children() {
        dump(&child, depth + 1);
    }
}

/* -- blocks ---------------------------------------------------------------- */

#[derive(Clone, Copy, PartialEq)]
enum Role {
    Abstract,
    List,
    Body,
}

impl Role {
    fn as_str(self) -> &'static str {
        match self {
            Role::Abstract => "abstract",
            Role::List => "list",
            Role::Body => "body",
        }
    }
}

struct Block {
    text: String,
    start: usize, // 1-based
    end: usize,   // 1-based
    section: String,
    role: Role,
}

fn extract(source: &str) -> Vec<Block> {
    let root = parse(source);
    let lines = Lines::new(source.to_string());
    let n = lines.len_lines();
    let ctx = Ctx {
        src: source,
        lines: &lines,
        n,
    };
    let mut classes = vec![LineClass::Blank; n];
    let mut captures: Vec<(usize, Vec<Block>)> = Vec::new();
    let mut section = String::new();
    let top: Vec<LinkedNode> = LinkedNode::new(&root).children().collect();
    classify(&ctx, &top, &mut classes, &mut captures, &mut section, false);
    run_machine(&ctx, &classes, &mut section, captures)
}

struct Ctx<'a> {
    src: &'a str,
    lines: &'a Lines<String>,
    n: usize,
}

impl Ctx<'_> {
    fn line_of(&self, byte: usize) -> usize {
        self.lines
            .byte_to_line(byte)
            .expect("byte offset inside the source")
    }
    fn line_start(&self, line: usize) -> usize {
        self.lines.line_to_byte(line).unwrap_or(self.src.len())
    }
    fn line_span(&self, line: usize) -> Range<usize> {
        let start = self.line_start(line);
        let end = self.lines.line_to_byte(line + 1).unwrap_or(self.src.len());
        start..end
    }
    fn line_blank(&self, line: usize) -> bool {
        self.src[self.line_span(line)].trim().is_empty()
    }
    /** Only whitespace between the line start and this byte. */
    fn at_line_start(&self, byte: usize) -> bool {
        self.src[self.line_start(self.line_of(byte))..byte]
            .trim()
            .is_empty()
    }
    /** The span is the whole trimmed content of a single line. */
    fn alone_on_line(&self, span: &Range<usize>) -> bool {
        let first = self.line_of(span.start);
        let last = self.line_of(span.end.saturating_sub(1).max(span.start));
        if first != last {
            return false;
        }
        let line = self.line_span(first);
        self.src[line.start..span.start].trim().is_empty()
            && self.src[span.end..line.end].trim().is_empty()
    }
}

/* -- line classification ---------------------------------------------------- */

#[derive(Clone)]
enum LineClass {
    /// Whitespace only (also the untouched default: a line with content has
    /// a tree node).
    Blank,
    /// Comment, lone label, code expression: dropped in place, the block
    /// around them continues.
    Skip,
    /// Code opening at line start: the span's whole lines are dropped (the
    /// scanner dropped whole lines), outranking prose sharing a boundary
    /// line. Like Skip, the block around it continues.
    HardSkip,
    /// Display math or fenced raw opening at line start: ends the current
    /// block, then dropped the same hard way.
    FlushSkip,
    KeepProse,
    KeepListFirst,
    KeepListCont,
    /// Structural heading; level 1 sets the section.
    Heading {
        level: usize,
        title: String,
    },
    /// A lone #strong[..] line (pandoc pseudo-heading); sets the section.
    Pseudo(String),
}

fn rank(c: &LineClass) -> u8 {
    match c {
        LineClass::Heading { .. } | LineClass::Pseudo(_) => 6,
        LineClass::HardSkip | LineClass::FlushSkip => 5,
        LineClass::KeepListFirst | LineClass::KeepListCont => 4,
        LineClass::KeepProse => 3,
        LineClass::Skip => 2,
        LineClass::Blank => 0,
    }
}

fn mark(ctx: &Ctx, classes: &mut [LineClass], span: &Range<usize>, cls: LineClass) {
    if span.start >= span.end {
        return;
    }
    let r = rank(&cls);
    let first = ctx.line_of(span.start);
    let last = ctx.line_of(span.end - 1).max(first);
    for line in first..=last {
        if ctx.line_blank(line) || rank(&classes[line]) >= r {
            continue;
        }
        classes[line] = cls.clone();
    }
}

fn mark_list(ctx: &Ctx, classes: &mut [LineClass], span: &Range<usize>) {
    if span.start >= span.end {
        return;
    }
    let first = ctx.line_of(span.start);
    let last = ctx.line_of(span.end - 1).max(first);
    for line in first..=last {
        if ctx.line_blank(line) || rank(&classes[line]) >= rank(&LineClass::KeepListFirst) {
            continue;
        }
        classes[line] = if line == first {
            LineClass::KeepListFirst
        } else {
            LineClass::KeepListCont
        };
    }
}

/**
 * Walk one Markup level (the document top level, or a captured container's
 * content) and classify the lines it touches. Captured containers emit their
 * blocks during the walk, attached to their opening line so the machine
 * places them in document order.
 */
fn classify(
    ctx: &Ctx,
    nodes: &[LinkedNode],
    classes: &mut [LineClass],
    captures: &mut Vec<(usize, Vec<Block>)>,
    section: &mut String,
    in_capture: bool,
) {
    let mut i = 0;
    while i < nodes.len() {
        let node = &nodes[i];
        match node.kind() {
            SyntaxKind::Space | SyntaxKind::Parbreak => {}
            SyntaxKind::Heading => {
                let level = heading_level(node);
                let title = heading_title(node);
                // Captures emit during this walk (document order), so the
                // section must be current here, not only in the machine.
                if level == 1 {
                    *section = title.clone();
                }
                mark(
                    ctx,
                    classes,
                    &node.range(),
                    LineClass::Heading { level, title },
                );
            }
            SyntaxKind::LineComment | SyntaxKind::BlockComment => {
                mark(ctx, classes, &node.range(), LineClass::Skip)
            }
            SyntaxKind::Label => {
                let cls = if ctx.alone_on_line(&node.range()) {
                    LineClass::Skip
                } else {
                    LineClass::KeepProse
                };
                mark(ctx, classes, &node.range(), cls);
            }
            SyntaxKind::Equation => {
                let text = node.get().full_text();
                let display =
                    (text.starts_with("$ ") || text.starts_with("$\n") || text.starts_with("$\r"))
                        && ctx.at_line_start(node.range().start);
                mark(
                    ctx,
                    classes,
                    &node.range(),
                    if display {
                        LineClass::FlushSkip
                    } else {
                        LineClass::KeepProse
                    },
                );
            }
            SyntaxKind::Raw => {
                let fenced = node.get().full_text().starts_with("```")
                    && ctx.at_line_start(node.range().start);
                mark(
                    ctx,
                    classes,
                    &node.range(),
                    if fenced {
                        LineClass::FlushSkip
                    } else {
                        LineClass::KeepProse
                    },
                );
            }
            SyntaxKind::ListItem | SyntaxKind::EnumItem | SyntaxKind::TermItem => {
                if in_capture {
                    mark(ctx, classes, &node.range(), LineClass::KeepProse);
                } else {
                    mark_list(ctx, classes, &node.range());
                }
            }
            SyntaxKind::Hash => {
                let expr = nodes.get(i + 1);
                let span = match expr {
                    Some(e) => node.range().start..e.range().end,
                    None => node.range(),
                };
                let mut captured = false;
                // Captured containers open at line start only. Inside a
                // captured container there is no nesting: every code
                // expression drops its whole lines, exactly like the
                // scanner's bracket walk.
                if !in_capture && ctx.at_line_start(node.range().start) {
                    if let Some(e) = expr {
                        match e.kind() {
                            SyntaxKind::FuncCall
                                if named(e, "strong") && ctx.alone_on_line(&span) =>
                            {
                                let title = pseudo_title(e);
                                *section = title.clone();
                                mark(ctx, classes, &span, LineClass::Pseudo(title));
                                captured = true;
                            }
                            SyntaxKind::FuncCall if named(e, "highlight") => {
                                if let Some(cb) = first_content_arg(e) {
                                    if ctx.line_of(cb.range().start) == ctx.line_of(span.start) {
                                        let blocks = capture_blocks(ctx, &cb, section, Role::Body);
                                        captures.push((ctx.line_of(span.start), blocks));
                                        captured = true;
                                    }
                                }
                            }
                            SyntaxKind::LetBinding if named(e, "abstract") => {
                                if let Some(cb) = let_content_value(e) {
                                    if ctx.line_of(cb.range().start) == ctx.line_of(span.start) {
                                        let blocks =
                                            capture_blocks(ctx, &cb, section, Role::Abstract);
                                        captures.push((ctx.line_of(span.start), blocks));
                                        captured = true;
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                if !captured {
                    // Line-initial code drops whole lines (the scanner's
                    // do-while consumed them); mid-line code skips in place.
                    let cls = if ctx.at_line_start(node.range().start) {
                        LineClass::HardSkip
                    } else {
                        LineClass::Skip
                    };
                    mark(ctx, classes, &span, cls);
                }
                i += 2;
                continue;
            }
            _ => mark(ctx, classes, &node.range(), LineClass::KeepProse),
        }
        i += 1;
    }
}

/* -- node interrogation ----------------------------------------------------- */

fn heading_level(node: &LinkedNode) -> usize {
    node.children()
        .find(|c| c.kind() == SyntaxKind::HeadingMarker)
        .map(|c| c.get().full_text().matches('=').count())
        .unwrap_or(1)
}

fn heading_title(node: &LinkedNode) -> String {
    let markup = node.children().find(|c| c.kind() == SyntaxKind::Markup);
    match markup {
        Some(m) => content_text(&m),
        None => String::new(),
    }
}

fn pseudo_title(strong_call: &LinkedNode) -> String {
    first_content_arg(strong_call)
        .and_then(|cb| cb.children().find(|c| c.kind() == SyntaxKind::Markup))
        .map(|m| content_text(&m))
        .unwrap_or_default()
}

/** Plain text of a markup region: strong wrappers unwrapped, labels gone. */
fn content_text(node: &LinkedNode) -> String {
    let mut out = String::new();
    collect_text(node, &mut out);
    out.trim().to_string()
}

fn collect_text(node: &LinkedNode, out: &mut String) {
    match node.kind() {
        SyntaxKind::Space | SyntaxKind::Linebreak | SyntaxKind::Parbreak => out.push(' '),
        SyntaxKind::Label | SyntaxKind::Hash => {}
        SyntaxKind::Text
        | SyntaxKind::SmartQuote
        | SyntaxKind::Escape
        | SyntaxKind::Shorthand
        | SyntaxKind::MathText => out.push_str(&node.get().full_text()),
        // Inside a call, only content-block arguments are prose.
        SyntaxKind::FuncCall => {
            for args in node.children().filter(|c| c.kind() == SyntaxKind::Args) {
                for a in args
                    .children()
                    .filter(|c| c.kind() == SyntaxKind::ContentBlock)
                {
                    collect_text(&a, out);
                }
            }
        }
        _ => {
            for child in node.children() {
                collect_text(&child, out);
            }
        }
    }
}

fn named(node: &LinkedNode, name: &str) -> bool {
    node_ident(node).is_some_and(|id| id == name)
}

fn node_ident(node: &LinkedNode) -> Option<String> {
    node.children()
        .find(|c| c.kind() == SyntaxKind::Ident)
        .map(|c| c.get().full_text().to_string())
}

fn first_content_arg<'a>(call: &'a LinkedNode<'a>) -> Option<LinkedNode<'a>> {
    call.children()
        .find(|c| c.kind() == SyntaxKind::Args)?
        .children()
        .find(|c| c.kind() == SyntaxKind::ContentBlock)
}

fn let_content_value<'a>(binding: &'a LinkedNode<'a>) -> Option<LinkedNode<'a>> {
    binding
        .children()
        .filter(|c| c.kind() == SyntaxKind::ContentBlock)
        .last()
}

/* -- captured containers ----------------------------------------------------- */

/**
 * A #let abstract or #highlight container: its content walks with the same
 * in-place skip rules (no nesting: inner code is plain skip, list items are
 * prose), pieces split at blank lines, dedented, and emitted with the
 * container's role.
 */
fn capture_blocks(ctx: &Ctx, content: &LinkedNode, section: &mut String, role: Role) -> Vec<Block> {
    let Some(markup) = content.children().find(|c| c.kind() == SyntaxKind::Markup) else {
        return Vec::new();
    };
    let inner = markup.range();
    let mut classes = vec![LineClass::Blank; ctx.n];
    let mut no_captures = Vec::new();
    classify(
        ctx,
        &markup.children().collect::<Vec<_>>(),
        &mut classes,
        &mut no_captures,
        section,
        true,
    );

    // Pieces: blank-line separated runs of kept lines; skipped lines vanish
    // without ending the piece (holes, like the scanner's kept-lines join).
    let first_line = ctx.line_of(inner.start);
    let last_line = ctx.line_of(inner.end.saturating_sub(1).max(inner.start));
    let mut pieces: Vec<Vec<(usize, String)>> = Vec::new();
    let mut open = false;
    for line in first_line..=last_line {
        if ctx.line_blank(line) {
            open = false;
            continue;
        }
        let keep = matches!(
            classes[line],
            LineClass::KeepProse | LineClass::KeepListFirst | LineClass::KeepListCont
        );
        if !keep {
            continue;
        }
        if !open {
            pieces.push(Vec::new());
            open = true;
        }
        let span = ctx.line_span(line);
        let start = span.start.max(inner.start);
        let end = span.end.min(inner.end).max(start);
        let text = ctx.src[start..end]
            .trim_end_matches(['\n', '\r'])
            .to_string();
        pieces.last_mut().unwrap().push((line, text));
    }

    let mut blocks = Vec::new();
    for piece in pieces {
        let texts: Vec<&str> = piece.iter().map(|(_, t)| t.as_str()).collect();
        let text = dedent(&texts).trim().to_string();
        let first = piece.first().unwrap().0 + 1;
        let last = piece.last().unwrap().0 + 1;
        emit(&text, first, last, role, section, &mut blocks);
    }
    blocks
}

/** Strip the longest common leading whitespace (spaces) from all lines.
 *  Pieces never contain blank lines (they are the split points). */
fn dedent(lines: &[&str]) -> String {
    let n = lines
        .iter()
        .map(|l| l.len() - l.trim_start_matches(' ').len())
        .min()
        .unwrap_or(0);
    lines.iter().map(|l| &l[n..]).collect::<Vec<_>>().join("\n")
}

/* -- block assembly ----------------------------------------------------------- */

/** Reference entries are not prose; the references section is not linted. */
fn section_dropped(section: &str) -> bool {
    let s = section.trim();
    s.eq_ignore_ascii_case("references") || s.eq_ignore_ascii_case("bibliography")
}

fn emit(text: &str, start: usize, end: usize, role: Role, section: &str, blocks: &mut Vec<Block>) {
    if section_dropped(section) {
        return;
    }
    if text.trim().chars().count() < MIN_CHARS {
        return;
    }
    let r = if role == Role::Body && section.trim().eq_ignore_ascii_case("abstract") {
        Role::Abstract
    } else {
        role
    };
    blocks.push(Block {
        text: text.to_string(),
        start,
        end,
        section: if r == Role::Abstract {
            "abstract".to_string()
        } else {
            section.to_string()
        },
        role: r,
    });
}

fn flush_into(kept: &mut Vec<(usize, String)>, role: Role, section: &str, blocks: &mut Vec<Block>) {
    if kept.is_empty() {
        return;
    }
    let text = kept
        .iter()
        .map(|(_, t)| t.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    let start = kept.first().unwrap().0 + 1;
    let end = kept.last().unwrap().0 + 1;
    emit(&text, start, end, role, section, blocks);
    kept.clear();
}

fn run_machine(
    ctx: &Ctx,
    classes: &[LineClass],
    section: &mut String,
    mut captures: Vec<(usize, Vec<Block>)>,
) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut kept: Vec<(usize, String)> = Vec::new();
    let mut role = Role::Body;
    let mut next_capture = 0usize;

    for line in 0..ctx.n {
        while next_capture < captures.len() && captures[next_capture].0 == line {
            // A capture opening mid-paragraph flushes first, so blocks stay
            // in document order (the scanner flushed before capturing).
            flush_into(&mut kept, role, section, &mut blocks);
            blocks.append(&mut captures[next_capture].1);
            next_capture += 1;
        }
        let raw = &ctx.src[ctx.line_span(line)];
        let line_text = raw.trim_end_matches(['\n', '\r']).to_string();
        let indented = raw.starts_with(' ') || raw.starts_with('\t');
        match &classes[line] {
            LineClass::Blank | LineClass::FlushSkip => {
                flush_into(&mut kept, role, section, &mut blocks)
            }
            LineClass::Skip | LineClass::HardSkip => {}
            LineClass::Heading { level, title } => {
                flush_into(&mut kept, role, section, &mut blocks);
                if *level == 1 {
                    *section = title.clone();
                }
            }
            LineClass::Pseudo(title) => {
                flush_into(&mut kept, role, section, &mut blocks);
                *section = title.clone();
            }
            LineClass::KeepListFirst => {
                if role != Role::List || kept.is_empty() {
                    flush_into(&mut kept, role, section, &mut blocks);
                    role = Role::List;
                }
                kept.push((line, line_text));
            }
            LineClass::KeepListCont => {
                if role != Role::List {
                    role = Role::Body;
                }
                kept.push((line, line_text));
            }
            LineClass::KeepProse => {
                if !kept.is_empty() && role == Role::List && !indented {
                    flush_into(&mut kept, role, section, &mut blocks);
                }
                if kept.is_empty() {
                    role = Role::Body;
                }
                kept.push((line, line_text));
            }
        }
    }
    flush_into(&mut kept, role, section, &mut blocks);
    blocks
}

/* -- JSON ------------------------------------------------------------------ */

fn to_json(blocks: &[Block]) -> String {
    let mut out = String::from("[");
    for (i, b) in blocks.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!(
            "{{\"text\":{},\"start\":{},\"end\":{},\"section\":{},\"role\":\"{}\"}}",
            json_string(&b.text),
            b.start,
            b.end,
            json_string(&b.section),
            b.role.as_str()
        ));
    }
    out.push(']');
    out
}

fn json_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}
