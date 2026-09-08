create table if not exists papers (
  doi text primary key,        -- as declared on the Cambridge page
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
