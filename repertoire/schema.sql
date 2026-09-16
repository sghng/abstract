create table if not exists papers (
  doi text primary key,        -- as declared on the publisher page
  doi_id text unique not null, -- filesystem-safe form: lower, '/' -> ':'
  title text,
  authors text,
  year integer,
  journal text not null,       -- journal slug, e.g. 'psychometrika'
  issue_url text,
  article_url text,
  pdf_url text,
  state text not null default 'listed',
  local_path text,
  sha256 text,
  error text,
  updated_at text default current_timestamp
);

create index if not exists idx_papers_state on papers(state);

-- D5: which artifact fed the md (html|xml|pdf|tex|docx); null until parsed.
alter table papers add column parse_source text;

-- D5: one row per raw artifact. key is the bucket object key
-- (raw/<doi_id>.<fmt>); format in pdf/html/xml/tex ('tex' = the gzipped
-- e-print tarball bytes for arXiv).
create table sources (
  doi text not null,
  format text not null check (format in ('pdf','html','xml','tex','docx')),
  key text,
  bytes integer,
  sha256 text,
  fetched_at text default current_timestamp,
  primary key (doi, format)
);

-- shipped in live D1 since the first build; DDL committed per the
-- rebuild plan (was missing from this file).
create table if not exists chunks (
  doi text not null,
  chunk_no integer not null,
  heading text,
  section text,
  line_start integer not null,
  line_end integer not null,
  primary key (doi, chunk_no)
);

-- assets: one row per referenced figure/table/equation. handle is the
-- short per-paper id in document order (fig01, tab01, math-0001); url is
-- the publisher URL for images, or the attachment key (<doi_id>:tab03.html)
-- for reconstructed complex tables.
create table if not exists assets (
  doi text not null,
  handle text not null,
  kind text not null,
  url text,            -- publisher provenance (may be dead at the CDN)
  attachment_key text, -- durable copy in repertoire-docs, e.g. assets/<doi_id>:eq0007.png
  caption text,
  primary key (doi, handle)
);
