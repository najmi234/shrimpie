-- =====================================================
-- Migration: Synchronize Vector Schema & Indexes (768 Dimensions)
-- Ensures database schema, match_documents function, and HNSW index
-- are fully aligned with 768-dimension embeddings across environments.
-- =====================================================

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Ensure documents table exists with vector(768)
CREATE TABLE IF NOT EXISTS public.documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  embedding vector(768)
);

-- Safely alter embedding column if it was previously 3072
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'documents' 
      AND column_name = 'embedding' 
      AND udt_name = 'vector'
  ) THEN
    -- Alter type if needed
    ALTER TABLE public.documents ALTER COLUMN embedding TYPE vector(768);
  END IF;
END $$;

-- Create HNSW index for fast Cosine similarity search
CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw 
ON public.documents 
USING hnsw (embedding vector_cosine_ops);

-- Ensure match_documents function matches LangChain SupabaseVectorStore signature
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    (1 - (documents.embedding <=> query_embedding))::float AS similarity
  FROM public.documents
  WHERE documents.metadata @> filter
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
