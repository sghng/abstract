//! The Markdown front of abstract-extract: comrak walks the document, the
//! same Block contract comes out. All Markdown dialect knowledge lives here
//! (CommonMark + GFM tables/footnotes, dollar math, YAML front matter), and
//! the policy mirrors the Typst side where the formats allow it: verbatim
//! source lines, the abstract special case, the references drop, MIN_CHARS,
//! display math skipped, quotes and code and tables skipped whole.
//!
//! Where the formats differ, Markdown gets its own reading: paragraphs are
//! first-class nodes (no classify/machine assembly needed), the section is
//! the nearest heading of any level (papers put sections at ## under a #
//! title, so H1-only would freeze the section at the title), and list items
//! are blocks of their own (one judgment per item).

use comrak::nodes::{AstNode, NodeValue};
use comrak::{parse_document, Arena, Options};

use crate::{emit, Block, Role};

pub fn extract(source: &str) -> Vec<Block> {
    let arena = Arena::new();
    let mut options = Options::default();
    options.extension.math_dollars = true;
    options.extension.front_matter_delimiter = Some("---".into());
    options.extension.table = true;
    options.extension.footnotes = true;
    options.extension.strikethrough = true;
    // Pandoc writes heading ids and link/reference attribute blocks into
    // headings ({#sec:...}, {reference-type=...}); parsed, they leave the
    // heading text.
    options.extension.header_attributes = true;
    options.extension.link_attributes = true;
    let root = parse_document(&arena, source, &options);

    let lines: Vec<&str> = source.split('\n').collect();
    let mut blocks = Vec::new();
    let mut section = String::new();
    for node in root.children() {
        let value = node.data.borrow().value.clone();
        match value {
            NodeValue::Paragraph => {
                let (start, end) = span(node);
                let (text, end) = slice_lines(&lines, start, end);
                // A pandoc grid table (a non-CommonMark extension) is one
                // glued paragraph starting with a +---+ border row; a
                // pandoc fenced div (::: center, ::: {.proof}) glues the
                // same way. Containers are skipped whole, like quotes.
                let container = text.lines().next().is_some_and(|l| {
                    let l = l.trim();
                    (l.starts_with('+') && l.ends_with('+') && l.contains('-'))
                        || (l.starts_with(":::")
                            && l.trim_start_matches(':')
                                .trim()
                                .chars()
                                .all(|c| c.is_alphanumeric() || " {}.-_#".contains(c)))
                });
                if !container && !display_math_only(node) {
                    emit(&text, start, end, Role::Body, &section, &mut blocks);
                }
            }
            NodeValue::Heading(_) => {
                section = heading_text(node);
            }
            NodeValue::List(_) => {
                for item in node.children() {
                    let is_item = matches!(
                        item.data.borrow().value,
                        NodeValue::Item(_) | NodeValue::TaskItem(_)
                    );
                    if !is_item {
                        continue;
                    }
                    let (start, end) = span(item);
                    let (text, end) = slice_lines(&lines, start, end);
                    emit(&text, start, end, Role::List, &section, &mut blocks);
                }
            }
            // Front matter, fenced/indented code, HTML blocks, tables,
            // thematic breaks, quotes (block and multiline, alerts too),
            // footnote definitions, description lists: not prose.
            _ => {}
        }
    }
    blocks
}

/** 1-based line span of a node, inclusive. */
fn span(node: &AstNode<'_>) -> (usize, usize) {
    let sp = node.data.borrow().sourcepos;
    (sp.start.line, sp.end.line)
}

/**
 * The verbatim source lines of a node, newline-joined. List items can own a
 * trailing blank line in their sourcepos; dropped from both text and span.
 */
fn slice_lines(lines: &[&str], start: usize, end: usize) -> (String, usize) {
    let mut end = end;
    while end > start && lines[end - 1].trim().is_empty() {
        end -= 1;
    }
    let text = lines[start - 1..end]
        .iter()
        .map(|l| l.trim_end_matches('\r'))
        .collect::<Vec<_>>()
        .join("\n")
        .trim_end()
        .to_string();
    (text, end)
}

/**
 * A paragraph that is display math and nothing else (`$$...$$` alone
 * between blank lines): the math analog of the Typst FlushSkip. Display
 * math sharing a paragraph with prose stays, like Typst inline math.
 */
fn display_math_only<'a>(node: &'a AstNode<'a>) -> bool {
    let mut any = false;
    for child in node.children() {
        match child.data.borrow().value {
            NodeValue::Math(ref m) if m.display_math => any = true,
            NodeValue::Text(ref t) if t.trim().is_empty() => {}
            NodeValue::SoftBreak | NodeValue::LineBreak => {}
            _ => return false,
        }
    }
    any
}

/** Plain text of a heading: formatting gone, code and math literals kept. */
fn heading_text<'a>(node: &'a AstNode<'a>) -> String {
    fn collect<'a>(n: &'a AstNode<'a>, out: &mut String) {
        match n.data.borrow().value {
            NodeValue::Text(ref t) => out.push_str(t),
            NodeValue::Code(ref c) => out.push_str(&c.literal),
            NodeValue::Math(ref m) => out.push_str(&m.literal),
            NodeValue::SoftBreak | NodeValue::LineBreak => out.push(' '),
            _ => {
                for child in n.children() {
                    collect(child, out);
                }
            }
        }
    }
    let mut out = String::new();
    collect(node, &mut out);
    out.trim().to_string()
}
