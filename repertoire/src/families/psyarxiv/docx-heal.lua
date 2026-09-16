-- docx-heal.lua: psyarxiv docx -> contract md, one pandoc pass.
-- Graduated 2026-09-16 from spike P3b (.cache/spike-parse/docx/):
--   heading promotion V1+ measured P=.996 R=.941 on 628 hand-labeled
--   candidates (14 heuristic files).
--
-- What it does (see NOTES.md in the spike state for rationale):
--   * promotes bold pseudo-headings: uniform-mark Para (Strong, or
--     nested Strong/Emph for bold+italic; italic-only on OLE2 hops via
--     the heal-emph metadata flag -- textutil drops bold there), plus
--     two structural variants: lone-candidate paragraphs inside
--     single-para blockquotes, and auto-numbered section lists (Word
--     numPr: every item a lone promotable candidate), <120 chars, no
--     trailing [.!?], Table/Figure/Equation/Keywords lexical veto,
--     front-matter suppression until a canonical heading (abstract/
--     introduction/method/... anchored within the first 4 candidates),
--     backmatter + Study-N/Experiment-N exempt anywhere, title capture
--     (first bold >=25 chars; questions allowed, "."/"!" not) with
--     exact-text dedupe. Soft hyphens/zero-width chars are stripped
--     (as UTF-8 literal sequences -- a byte class would eat en-dashes)
--   * native-header cleanup: empty dropped, sentence-ended demoted to
--     Para (Citavi prose artifacts), level+1 clamped to 3, Strong/Emph
--     unwrapped
--   * injects `# <title>` (docx meta > leading native header > first
--     bold-long para > first short para)
--   * strips References sections header-to-header (blockquoted variants
--     included; sections after refs survive, e.g. Cell supplements);
--     headings merely ENDING in "References" match (supplement lists)
--   * lifts equation-number layout tables to $$..$$ paras (cells = only
--     display math + (N) labels; nested-in-cell variants inlined so
--     pipe tables survive)
--   * strips Span/Underline styling (the writer would emit raw
--     <span class="underline">/[x]{.underline}) from prose everywhere
--   * drops letterless bold noise paragraphs
--
-- Levels: numbering ("1." -> ##, "1.1" -> ###), else canonical/backmatter
-- lexicon -> ##, else ###; a ### is never emitted before the first ##.
-- Known limits (graduation residuals): question-headings ending in "?"
-- are not promoted (precision-first); leveling via lexicon only (0.80 vs
-- 0.95 with document.xml center/size, which the AST drops); emails/
-- ORCIDs in title blocks survive; italic lead-ins in real docx stay
-- inline; Span styling is dropped (text kept).

local function match_any(s, pats)
  local low = s:lower()
  for _, p in ipairs(pats) do if low:find(p) then return true end end
  return false
end
local P_LEX   = { '^%s*table%s*s?%d', '^%s*figure%s*s?%d', '^%s*fig%.?%s*s?%d', '^%s*equation%s', '^%s*tab%.?%s*%d', '^%s*panel%s' }
local P_KW    = { '^%s*key%s?words' }
local P_CANON = { '^%s*abstract', '^%s*summary', '^%s*introduction', '^%s*background', '^%s*methods?', '^%s*materials', '^%s*results?', '^%s*discussions?', '^%s*conclusions?', '^%s*references', '^%s*overview', '^%s*theory', '^%s*theories', '^%s*experiment %d', '^%s*study %d', '^%s*general discussion', '^%s*literature review', '^%s*1%.?%s' }
local P_BACK  = { 'acknowledg', 'declar', 'funding', 'disclos', 'contribution', 'data availab', 'ethic', 'conflict', 'reference', 'supplement', 'appendix', 'author' }
local P_STUDY = { '^%s*study %d', '^%s*experiment %d' }
local P_REFH  = { 'references?%s*$', '%s*bibliography%s*$', '^%s*works cited%s*$' }

local function tlen(s)
  local ok, n = pcall(function() return pandoc.text.length(s) end)
  return ok and n or #s
end

-- invisible chars stripped as UTF-8 LITERAL sequences: a byte class
-- would eat the E2/80 lead bytes of en-dashes and curly quotes
local INVIS = { '\u{00AD}', '\u{200B}', '\u{200C}', '\u{200D}', '\u{FEFF}' }
local function strip_invis(s)
  for _, p in ipairs(INVIS) do s = s:gsub(p, '') end
  return s
end
local function clean(s)
  return (strip_invis(s):match('^%s*(.-)%s*$') or '')
end
-- Str holding only invisible/whitespace chars (Word hyphenation junk)
local function invisible_str(s)
  return strip_invis(s):gsub('%s', '') == ''
end

-- pandoc 3.11 TableBody fields: attr, head (row-head rows), body (rows)
local function table_rows(tbl)
  local rows = {}
  local function add(rs) for _, r in ipairs(rs or {}) do rows[#rows + 1] = r end end
  if tbl.head then add(tbl.head.rows) end
  if tbl.foot then add(tbl.foot.rows) end
  for _, body in ipairs(tbl.bodies or {}) do
    add(body.head); add(body.body)
  end
  return rows
end

-- equation-number layout table? every cell holds only display math or (N)
local function equation_table(tbl)
  local math_out = {}
  for _, row in ipairs(table_rows(tbl)) do
    for _, cell in ipairs(row.cells or {}) do
      for _, b in ipairs(cell.contents or {}) do
        if b.t == 'Para' or b.t == 'Plain' then
          for _, inl in ipairs(b.content) do
            if inl.t == 'Math' and inl.mathtype == 'DisplayMath' then
              math_out[#math_out + 1] = pandoc.Math('DisplayMath', inl.text)
            elseif inl.t == 'Str' and clean(inl.text):find('^%(([%d%a]+)%)$') then
              -- equation label (N): dropped
            elseif inl.t == 'Space' or inl.t == 'SoftBreak' then
            else return nil
            end
          end
        elseif b.t ~= 'Null' then return nil end
      end
    end
  end
  if #math_out == 0 then return nil end
  local paras = {}
  for _, m in ipairs(math_out) do paras[#paras + 1] = pandoc.Para({ m }) end
  return paras
end

-- lift equation tables nested inside table cells (Word layout nesting)
local function heal_nested_tables(tbl)
  local function fix_cell(cell)
    local newb, changed = {}, false
    for _, b in ipairs(cell.contents or {}) do
      if b.t == 'Table' then
        local eq = equation_table(b)
        if eq then
          for _, p in ipairs(eq) do
            -- display math inside a cell forces grid tables: inline it
            for _, i in ipairs(p.content or {}) do
              if i.t == 'Math' and i.mathtype == 'DisplayMath' then
                i.mathtype = 'InlineMath'
              end
            end
            newb[#newb + 1] = p
          end
          changed = true
        else newb[#newb + 1] = heal_nested_tables(b) end
      else newb[#newb + 1] = b end
    end
    if changed then cell.contents = newb end
  end
  for _, r in ipairs(table_rows(tbl)) do
    for _, c in ipairs(r.cells or {}) do fix_cell(c) end
  end
  return tbl
end

-- unwrap Divs (custom-style carriers) to a flat top-level list
local function flatten(blocks, out)
  for _, b in ipairs(blocks) do
    if b.t == 'Div' then flatten(b.content, out)
    else out[#out + 1] = b end
  end
  return out
end

local function header_level(s)
  local n = s:match('^%s*(%d+[%d%.]*)%.?%s+%S')
  if n then
    local dots = 0
    for _ in n:gmatch('%.') do dots = dots + 1 end
    return math.min(3, dots + 2)
  end
  if match_any(s, P_CANON) or match_any(s, P_BACK) then return 2 end
  return 3
end

-- heading candidate: every top-level inline is Strong/Emph/whitespace
-- (Word marks bold+italic as nested marks: ***Text*** -> Emph[Strong[..]]);
-- bold required, unless heal-emph (OLE2 hops) widens it to italic-only.
-- unwrap_mark flattens ALL marks (heading text carries no emphasis);
-- strip_styling removes only Span/Underline (the writer would otherwise
-- emit raw <span class="underline"> / [x]{.underline}) from prose.
local function unwrap_mark(inls, out)
  for _, i in ipairs(inls) do
    if i.t == 'Strong' or i.t == 'Emph' or i.t == 'Span' or i.t == 'Underline' then
      unwrap_mark(i.content, out)
    elseif i.t == 'Str' then
      local t = strip_invis(i.text)
      if t ~= '' then out[#out + 1] = pandoc.Str(t) end
    else out[#out + 1] = i end
  end
  return out
end

local function strip_styling(inls)
  -- depth-first: clean every container inline (Strong/Emph/Link/...),
  -- then flatten Span/Underline at this level
  local function clean(i)
    if type(i.content) == 'table' then
      for _, c in ipairs(i.content) do clean(c) end
      local out = {}
      for _, c in ipairs(i.content) do
        if c.t == 'Span' or c.t == 'Underline' then
          for _, g in ipairs(c.content) do out[#out + 1] = g end
        else out[#out + 1] = c end
      end
      i.content = out
    end
  end
  for _, i in ipairs(inls) do clean(i) end
  local out = {}
  for _, i in ipairs(inls) do
    if i.t == 'Span' or i.t == 'Underline' then
      for _, g in ipairs(i.content) do out[#out + 1] = g end
    else out[#out + 1] = i end
  end
  return out
end

local function heal(doc)
  local blocks = flatten(doc.blocks, {})
  local emph_raw = doc.meta['heal-emph']
  local emph_ok = emph_raw ~= nil and pandoc.utils.stringify(emph_raw):find('%S') ~= nil
  local function candidate(b)
    -- top level may mix Strong/Emph/Span/Underline (Word bold+italic can
    -- nest either way: ***x*** -> Emph[Strong[..]] or Strong[Emph[..]]);
    -- invisible-only Str (soft hyphens) counts as whitespace. Bold is
    -- required anywhere in the mark tree, unless heal-emph widens it.
    local function strong_deep(i)
      if i.t == 'Strong' then return true end
      if i.t == 'Emph' or i.t == 'Span' or i.t == 'Underline' then
        for _, c in ipairs(i.content) do
          if strong_deep(c) then return true end
        end
      end
      return false
    end
    local has_mark, has_strong = false, false
    for _, inl in ipairs(b.content) do
      local t = inl.t
      if t == 'Strong' or t == 'Emph' or t == 'Span' or t == 'Underline' then
        has_mark = true
        if strong_deep(inl) then has_strong = true end
      elseif t == 'Space' or t == 'SoftBreak' or t == 'LineBreak' then
      elseif t == 'Str' and invisible_str(inl.text) then
      else return false end
    end
    return has_mark and (has_strong or emph_ok)
  end
  -- pass 1: landmarks over bold candidates (incl. single-para blockquotes)
  local cands, first_bold_long = {}, nil
  local function add_cand(s)
    cands[#cands + 1] = s
    if not first_bold_long and tlen(s) >= 25
      and not s:find('[%.%!]%s*$') -- titles may be questions
      and not match_any(s, P_LEX) and not match_any(s, P_KW) then
      first_bold_long = s
    end
  end
  for _, b in ipairs(blocks) do
    if b.t == 'Para' and candidate(b) then
      add_cand(clean(pandoc.utils.stringify(b)))
    elseif b.t == 'BlockQuote' and #b.content == 1 and b.content[1].t == 'Para'
      and candidate(b.content[1]) then
      add_cand(clean(pandoc.utils.stringify(b.content[1])))
    end
  end
  local canon_idx -- front region ends at first canonical candidate (early)
  for i, s in ipairs(cands) do
    if i > 4 then break end
    if match_any(s, P_CANON) then canon_idx = i break end
  end
  local title
  if doc.meta.title and doc.meta.title.t then title = clean(pandoc.utils.stringify(doc.meta.title)) end
  if (not title or title == '') and blocks[1] and blocks[1].t == 'Header' then
    title = clean(pandoc.utils.stringify(blocks[1])) -- leading native header
  end
  if not title or title == '' then title = first_bold_long end
  if not title or title == '' then
    for _, b in ipairs(blocks) do
      if b.t == 'Para' or b.t == 'Plain' then
        local s = clean(pandoc.utils.stringify(b))
        if s:find('%a') and tlen(s) <= 200 then title = s end
        break
      end
    end
  end
  -- pass 2: rewrite
  local out, seen_h2, title_done, cand_i = {}, false, false, 0
  local function emit_title()
    if not title_done and title and title ~= '' then
      out[#out + 1] = pandoc.Header(1, { pandoc.Str(title) })
      title_done = true
    end
  end
  local function add_header(lvl, content)
    if lvl == 3 and not seen_h2 then lvl = 2 end
    if lvl <= 2 then seen_h2 = true end
    out[#out + 1] = pandoc.Header(lvl, content)
  end
  for _, b in ipairs(blocks) do
    local s = (b.t == 'Header' or b.t == 'Para' or b.t == 'Plain')
      and clean(pandoc.utils.stringify(b)) or nil
    -- single-para blockquotes act as pseudo-headings (pbc49 scale annex)
    local pb = b
    if b.t == 'BlockQuote' and #b.content == 1 and b.content[1].t == 'Para' then
      pb = b.content[1]
      s = clean(pandoc.utils.stringify(pb))
    end
    -- auto-numbered section list (Word numPr): every item a lone
    -- candidate paragraph -> the items are headings (3whj7 Discussion);
    -- if ANY item fails promotion the list stays a list (pvjac's
    -- numbered research questions keep their markers)
    if b.t == 'OrderedList' then
      local all_cand, all_promote = #b.content > 0, true
      for _, item in ipairs(b.content) do
        if not (#item == 1 and item[1].t == 'Para' and candidate(item[1])) then
          all_cand = false
          break
        end
        local it = clean(pandoc.utils.stringify(item[1]))
        if not it:find('[%a%d]') or tlen(it) >= 120 or it:find('[%.%!%?]%s*$')
          or match_any(it, P_LEX) or match_any(it, P_KW) then
          all_promote = false
        end
      end
      if all_cand and all_promote then
        for _, item in ipairs(b.content) do
          local it = clean(pandoc.utils.stringify(item[1]))
          emit_title()
          add_header(header_level(it), unwrap_mark(item[1].content, {}))
        end
        goto continue
      end
    end
    if b.t == 'Header' then
      if s == '' or not s:find('%a') or (title and s == title and not title_done) then
        emit_title() -- empty or native-title header: consumed
      elseif s:find('[%.%!%?]%s*$') then
        emit_title(); out[#out + 1] = pandoc.Para(b.content) -- sentence-ended: prose
      else
        emit_title(); add_header(math.min(3, b.level + 1), unwrap_mark(b.content, {}))
      end
    elseif pb.t == 'Para' and candidate(pb) then
      cand_i = cand_i + 1
      local front = canon_idx ~= nil and cand_i < canon_idx
        and not match_any(s, P_BACK) and not match_any(s, P_STUDY)
      local veto = tlen(s) >= 120 or s:find('[%.%!%?]%s*$')
        or match_any(s, P_LEX) or match_any(s, P_KW)
      if title and s == title then
        emit_title() -- source title paragraph consumed
      elseif not s:find('[%a%d]') then
        -- letterless bold noise (empty markers, stray **\**): dropped
      elseif not front and not veto then
        emit_title(); add_header(header_level(s), unwrap_mark(pb.content, {}))
      else
        emit_title(); out[#out + 1] = b
      end
    elseif (b.t == 'Para' or b.t == 'Plain') and title and s == title and not title_done then
      emit_title() -- plain-text title paragraph consumed
    elseif b.t == 'Table' then
      emit_title()
      local eq = equation_table(b)
      if eq then
        for _, p in ipairs(eq) do out[#out + 1] = p end
      else
        out[#out + 1] = heal_nested_tables(b)
      end
    else
      emit_title(); out[#out + 1] = b
    end
    ::continue::
  end
  emit_title()
  -- final: strip References sections (header + body until next header);
  -- headings can hide inside blockquotes (Cell-style preprints)
  local final, refs = {}, false
  for _, b in ipairs(out) do
    if b.t == 'Header' then
      local hs = clean(pandoc.utils.stringify(b))
      refs = match_any(hs, P_REFH)
      if not refs then final[#final + 1] = b end
    elseif b.t == 'BlockQuote' and not refs then
      local qs = clean(pandoc.utils.stringify(b))
      if match_any(qs, P_REFH) then refs = true else final[#final + 1] = b end
    elseif not refs then
      final[#final + 1] = b
    end
  end
  -- sweep remaining styling wrappers (underlined runs in prose; the
  -- writer would emit raw <span>/[x]{.underline}) from text blocks +
  -- lists + cells
  local function sweep(blocks)
    for _, b in ipairs(blocks) do
      if (b.t == 'Para' or b.t == 'Plain' or b.t == 'Header') and b.content then
        b.content = strip_styling(b.content)
      elseif b.t == 'BulletList' then
        for _, item in ipairs(b.content) do sweep(item) end
      elseif b.t == 'OrderedList' then
        for _, item in ipairs(b.content[2] or b.content[1] or {}) do sweep(item) end
      elseif b.t == 'BlockQuote' then sweep(b.content)
      elseif b.t == 'Table' then
        for _, r in ipairs(table_rows(b)) do
          for _, c in ipairs(r.cells or {}) do sweep(c.contents or {}) end
        end
      end
    end
  end
  sweep(final)
  doc.blocks = final
  return doc
end

return { { Pandoc = heal } }
