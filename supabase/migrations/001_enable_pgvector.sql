-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Documents table for storing chunked text + embeddings
create table public.documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(3072)
);

-- Note: vector index skipped because pgvector limits indexes to 2000 dims.
-- For small datasets, sequential scan is fast enough.

-- RLS policy (allow authenticated users to read)
alter table public.documents enable row level security;
create policy "Allow authenticated read" on public.documents for select to authenticated using (true);

-- Similarity search function
create or replace function public.match_documents(
  query_embedding vector(3072),
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    id, content, metadata,
    1 - (embedding <=> query_embedding) as similarity
  from public.documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
