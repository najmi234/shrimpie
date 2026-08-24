-- =====================================================
-- Migration: Knowledge Base Versioning & Lifecycle Schema
-- Introduces versioned knowledge bases, source document records,
-- document chunks with locked embedding models, and atomic activation.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1. Knowledge Bases Table
CREATE TABLE IF NOT EXISTS public.knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('BUILDING', 'READY', 'ACTIVE', 'FAILED', 'INACTIVE')),
  embedding_provider TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_dimension INT NOT NULL DEFAULT 768,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- 2. Source Documents Table
CREATE TABLE IF NOT EXISTS public.source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  checksum TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Document Chunks Table
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id BIGSERIAL PRIMARY KEY,
  knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.source_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW Vector Index on document_chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- KB Index on document_chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_kb_id 
ON public.document_chunks(knowledge_base_id);

-- 4. Match Function for Versioned Chunks
CREATE OR REPLACE FUNCTION public.match_knowledge_base_documents(
  query_embedding vector(768),
  active_kb_id uuid,
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
    document_chunks.id,
    document_chunks.content,
    document_chunks.metadata,
    (1 - (document_chunks.embedding <=> query_embedding))::float AS similarity
  FROM public.document_chunks
  WHERE document_chunks.knowledge_base_id = active_kb_id
    AND document_chunks.metadata @> filter
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Atomic Activation RPC Function
CREATE OR REPLACE FUNCTION public.activate_knowledge_base(target_kb_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  target_status text;
BEGIN
  SELECT status INTO target_status
  FROM public.knowledge_bases
  WHERE id = target_kb_id;

  IF target_status IS NULL THEN
    RAISE EXCEPTION 'Knowledge base % not found', target_kb_id;
  END IF;

  IF target_status NOT IN ('READY', 'INACTIVE') THEN
    RAISE EXCEPTION 'Cannot activate Knowledge base % with status %', target_kb_id, target_status;
  END IF;

  -- Deactivate current ACTIVE knowledge bases
  UPDATE public.knowledge_bases
  SET status = 'INACTIVE'
  WHERE status = 'ACTIVE';

  -- Activate target knowledge base
  UPDATE public.knowledge_bases
  SET status = 'ACTIVE',
      activated_at = NOW()
  WHERE id = target_kb_id;

  RETURN TRUE;
END;
$$;
