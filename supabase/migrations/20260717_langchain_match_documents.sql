-- =====================================================
-- Migration: Update match_documents for LangChain SupabaseVectorStore
-- 
-- LangChain's SupabaseVectorStore expects a different function signature:
--   match_documents(query_embedding, match_count, filter)
-- instead of the previous:
--   match_documents(query_embedding, match_threshold, match_count)
--
-- Also truncates existing documents since the embedding model is
-- changing from Gemini to OpenAI text-embedding-3-small.
-- =====================================================

-- Drop old function signature (different parameter types)
DROP FUNCTION IF EXISTS public.match_documents(vector(768), float, int);

-- Truncate existing embeddings (incompatible model change)
TRUNCATE public.documents;

-- Create new function compatible with LangChain SupabaseVectorStore
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(768),
  match_count int default 5,
  filter jsonb default '{}'
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
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM public.documents
  WHERE documents.metadata @> filter
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
