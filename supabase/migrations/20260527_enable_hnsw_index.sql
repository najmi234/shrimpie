-- =====================================================
-- Migration: Reduce Vector Dimensions & Enable HNSW Index
-- 1. Truncate existing documents table to allow dimension change.
-- 2. Alter embedding column from vector(3072) to vector(768).
-- 3. Redefine match_documents function to use vector(768).
-- 4. Create HNSW index on embedding column.
-- =====================================================

-- Clear existing document embeddings
TRUNCATE public.documents;

-- Alter embedding column to 768 dimensions
ALTER TABLE public.documents ALTER COLUMN embedding TYPE vector(768);

-- Redefine similarity search function for 768 dimensions
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(768),
  match_threshold float default 0.5,
  match_count int default 5
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, content, metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.documents
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Create HNSW index using Cosine similarity
CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw 
ON public.documents 
USING hnsw (embedding vector_cosine_ops);
