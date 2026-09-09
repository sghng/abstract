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

-- assets: one row per referenced figure/table/equation. handle is the
-- short per-paper id in document order (fig01, tab01, math-0001); url is
-- the publisher URL for images, or the attachment key (<doi_id>:tab03.html)
-- for reconstructed complex tables.
create table if not exists assets (
  doi text not null,
  handle text not null,
  kind text not null,
  url text,
  caption text,
  primary key (doi, handle)
);
