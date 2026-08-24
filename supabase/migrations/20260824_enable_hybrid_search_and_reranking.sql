-- =====================================================
-- Migration: Enable Hybrid Retrieval (Vector + Full-Text Search with RRF)
-- Creates GIN indexes for FTS and RPC functions performing Reciprocal Rank Fusion.
-- =====================================================

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1. Ensure tables exist safely
CREATE TABLE IF NOT EXISTS public.documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Full-Text Search GIN Indexes
CREATE INDEX IF NOT EXISTS idx_document_chunks_fts 
ON public.document_chunks 
USING gin (to_tsvector('simple', content));

CREATE INDEX IF NOT EXISTS idx_documents_fts 
ON public.documents 
USING gin (to_tsvector('simple', content));

-- 3. Match Function for Versioned Knowledge Base Chunks with Hybrid RRF
CREATE OR REPLACE FUNCTION public.match_hybrid_knowledge_base_documents(
  query_text text,
  query_embedding vector(768),
  active_kb_id uuid,
  match_count int DEFAULT 15,
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float,
  rrf_score float,
  dense_rank int,
  fts_rank int
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH dense_search AS (
    SELECT
      dc.id,
      dc.content,
      dc.metadata,
      (1 - (dc.embedding <=> query_embedding))::float AS similarity,
      ROW_NUMBER() OVER (ORDER BY dc.embedding <=> query_embedding ASC)::int AS dense_rank
    FROM public.document_chunks dc
    WHERE dc.knowledge_base_id = active_kb_id
    ORDER BY dc.embedding <=> query_embedding ASC
    LIMIT match_count * 2
  ),
  fts_search AS (
    SELECT
      dc.id,
      dc.content,
      dc.metadata,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(to_tsvector('simple', dc.content), plainto_tsquery('simple', query_text)) DESC
      )::int AS fts_rank
    FROM public.document_chunks dc
    WHERE dc.knowledge_base_id = active_kb_id
      AND (
        to_tsvector('simple', dc.content) @@ plainto_tsquery('simple', query_text)
        OR query_text = ''
      )
    ORDER BY ts_rank_cd(to_tsvector('simple', dc.content), plainto_tsquery('simple', query_text)) DESC
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT
      COALESCE(d.id, f.id) AS chunk_id,
      COALESCE(d.content, f.content) AS chunk_content,
      COALESCE(d.metadata, f.metadata) AS chunk_metadata,
      COALESCE(d.similarity, 0.0)::float AS similarity,
      d.dense_rank,
      f.fts_rank,
      (
        COALESCE(1.0 / (rrf_k + d.dense_rank), 0.0) +
        COALESCE(1.0 / (rrf_k + f.fts_rank), 0.0)
      )::float AS computed_rrf_score
    FROM dense_search d
    FULL OUTER JOIN fts_search f ON d.id = f.id
  )
  SELECT
    c.chunk_id AS id,
    c.chunk_content AS content,
    c.chunk_metadata AS metadata,
    c.similarity,
    c.computed_rrf_score AS rrf_score,
    c.dense_rank,
    c.fts_rank
  FROM combined c
  ORDER BY c.computed_rrf_score DESC
  LIMIT match_count;
END;
$$;

-- 4. Match Function for Fallback Legacy Documents Table with Hybrid RRF
CREATE OR REPLACE FUNCTION public.match_hybrid_documents(
  query_text text,
  query_embedding vector(768),
  match_count int DEFAULT 15,
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float,
  rrf_score float,
  dense_rank int,
  fts_rank int
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH dense_search AS (
    SELECT
      d.id,
      d.content,
      d.metadata,
      (1 - (d.embedding <=> query_embedding))::float AS similarity,
      ROW_NUMBER() OVER (ORDER BY d.embedding <=> query_embedding ASC)::int AS dense_rank
    FROM public.documents d
    ORDER BY d.embedding <=> query_embedding ASC
    LIMIT match_count * 2
  ),
  fts_search AS (
    SELECT
      d.id,
      d.content,
      d.metadata,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(to_tsvector('simple', d.content), plainto_tsquery('simple', query_text)) DESC
      )::int AS fts_rank
    FROM public.documents d
    WHERE to_tsvector('simple', d.content) @@ plainto_tsquery('simple', query_text)
       OR query_text = ''
    ORDER BY ts_rank_cd(to_tsvector('simple', d.content), plainto_tsquery('simple', query_text)) DESC
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT
      COALESCE(d.id, f.id) AS doc_id,
      COALESCE(d.content, f.content) AS doc_content,
      COALESCE(d.metadata, f.metadata) AS doc_metadata,
      COALESCE(d.similarity, 0.0)::float AS similarity,
      d.dense_rank,
      f.fts_rank,
      (
        COALESCE(1.0 / (rrf_k + d.dense_rank), 0.0) +
        COALESCE(1.0 / (rrf_k + f.fts_rank), 0.0)
      )::float AS computed_rrf_score
    FROM dense_search d
    FULL OUTER JOIN fts_search f ON d.id = f.id
  )
  SELECT
    c.doc_id AS id,
    c.doc_content AS content,
    c.doc_metadata AS metadata,
    c.similarity,
    c.computed_rrf_score AS rrf_score,
    c.dense_rank,
    c.fts_rank
  FROM combined c
  ORDER BY c.computed_rrf_score DESC
  LIMIT match_count;
END;
$$;
