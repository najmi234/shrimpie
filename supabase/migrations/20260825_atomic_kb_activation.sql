-- ============================================================
-- Migration: Atomic Knowledge Base Activation
-- Date: 2026-08-25
--
-- Purpose:
-- 1. Replace old activate_knowledge_base(UUID) function safely.
-- 2. Ensure Knowledge Base activation is atomic.
-- 3. Prevent empty / unfinished KB from becoming ACTIVE.
-- 4. Ensure only one Knowledge Base can be ACTIVE.
-- 5. Prevent concurrent activation race conditions.
-- ============================================================


-- ============================================================
-- 1. DROP OLD FUNCTION
-- ============================================================
-- PostgreSQL does not allow CREATE OR REPLACE FUNCTION
-- to change an existing function's return type.
--
-- Therefore the previous function must be dropped first.
--
-- This DOES NOT delete:
-- - knowledge_bases
-- - source_documents
-- - document_chunks
-- - embeddings
--
-- It only removes the old RPC definition.
-- ============================================================

DROP FUNCTION IF EXISTS public.activate_knowledge_base(UUID);


-- ============================================================
-- 2. VALIDATE EXISTING ACTIVE KNOWLEDGE BASES
-- ============================================================
-- Before adding the unique partial index below, make sure
-- the database does not currently contain more than one
-- ACTIVE knowledge base.
--
-- We intentionally fail instead of silently changing data.
-- ============================================================

DO $$
DECLARE
    active_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO active_count
    FROM public.knowledge_bases
    WHERE status = 'ACTIVE';

    IF active_count > 1 THEN
        RAISE EXCEPTION
            'Cannot install atomic KB activation: found % ACTIVE knowledge bases. Resolve duplicate ACTIVE rows first.',
            active_count;
    END IF;
END;
$$;


-- ============================================================
-- 3. DATABASE INVARIANT:
--    MAXIMUM ONE ACTIVE KNOWLEDGE BASE
-- ============================================================
-- Because every row covered by this partial index has the
-- same status = ACTIVE, UNIQUE prevents multiple ACTIVE rows.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_knowledge_bases_single_active
ON public.knowledge_bases (status)
WHERE status = 'ACTIVE';


-- ============================================================
-- 4. CREATE ATOMIC ACTIVATION FUNCTION
-- ============================================================

CREATE FUNCTION public.activate_knowledge_base(
    target_kb_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    target_kb               public.knowledge_bases%ROWTYPE;

    previous_active_kb_id   UUID;

    document_count          INTEGER;
    chunk_count             INTEGER;
    embedding_count         INTEGER;

    updated_rows            INTEGER;

    result                  JSONB;
BEGIN

    -- ========================================================
    -- A. SERIALIZE KB ACTIVATION
    -- ========================================================
    -- Two activation requests must not modify KB status at
    -- exactly the same time.
    --
    -- This table lock exists only for the duration of the
    -- current transaction/function execution.
    -- ========================================================

    LOCK TABLE public.knowledge_bases
    IN EXCLUSIVE MODE;


    -- ========================================================
    -- B. LOAD TARGET KB
    -- ========================================================

    SELECT *
    INTO target_kb
    FROM public.knowledge_bases
    WHERE id = target_kb_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Target Knowledge Base dengan ID % tidak ditemukan.',
            target_kb_id;
    END IF;


    -- ========================================================
    -- C. IDEMPOTENT BEHAVIOR
    -- ========================================================
    -- Calling the RPC again for an already ACTIVE KB should
    -- not break anything.
    -- ========================================================

    IF target_kb.status = 'ACTIVE' THEN

        RETURN jsonb_build_object(
            'success', true,
            'already_active', true,
            'kb_id', target_kb.id,
            'version', target_kb.version,
            'status', target_kb.status,
            'message', format(
                'Knowledge Base v%s sudah ACTIVE.',
                target_kb.version
            )
        );

    END IF;


    -- ========================================================
    -- D. VALIDATE KB LIFECYCLE
    -- ========================================================
    -- Valid lifecycle:
    --
    -- BUILDING
    --    ↓
    -- READY
    --    ↓
    -- ACTIVE
    --
    -- FAILED / BUILDING / INACTIVE cannot directly become
    -- ACTIVE through this RPC.
    -- ========================================================

    IF target_kb.status <> 'READY' THEN
        RAISE EXCEPTION
            'Knowledge Base v% tidak dapat diaktifkan. Status saat ini: %. Hanya Knowledge Base berstatus READY yang dapat diaktifkan.',
            target_kb.version,
            target_kb.status;
    END IF;


    -- ========================================================
    -- E. VALIDATE SOURCE DOCUMENTS
    -- ========================================================

    SELECT COUNT(*)
    INTO document_count
    FROM public.source_documents
    WHERE knowledge_base_id = target_kb_id;


    IF document_count = 0 THEN
        RAISE EXCEPTION
            'Knowledge Base v% tidak memiliki source document dan tidak dapat diaktifkan.',
            target_kb.version;
    END IF;


    -- ========================================================
    -- F. VALIDATE DOCUMENT CHUNKS
    -- ========================================================

    SELECT COUNT(*)
    INTO chunk_count
    FROM public.document_chunks
    WHERE knowledge_base_id = target_kb_id;


    IF chunk_count = 0 THEN
        RAISE EXCEPTION
            'Knowledge Base v% tidak memiliki document chunks dan tidak dapat diaktifkan.',
            target_kb.version;
    END IF;


    -- ========================================================
    -- G. VALIDATE EMBEDDINGS
    -- ========================================================
    -- Every chunk that will participate in RAG should have
    -- an embedding before KB activation.
    -- ========================================================

    SELECT COUNT(*)
    INTO embedding_count
    FROM public.document_chunks
    WHERE knowledge_base_id = target_kb_id
      AND embedding IS NOT NULL;


    IF embedding_count <> chunk_count THEN
        RAISE EXCEPTION
            'Knowledge Base v% belum lengkap. Total chunks: %, chunks dengan embedding: %.',
            target_kb.version,
            chunk_count,
            embedding_count;
    END IF;


    -- ========================================================
    -- H. VALIDATE EMBEDDING CONFIG
    -- ========================================================

    IF target_kb.embedding_provider IS NULL
       OR BTRIM(target_kb.embedding_provider) = '' THEN

        RAISE EXCEPTION
            'Knowledge Base v% tidak memiliki embedding_provider.',
            target_kb.version;

    END IF;


    IF target_kb.embedding_model IS NULL
       OR BTRIM(target_kb.embedding_model) = '' THEN

        RAISE EXCEPTION
            'Knowledge Base v% tidak memiliki embedding_model.',
            target_kb.version;

    END IF;


    IF target_kb.embedding_dimension IS NULL
       OR target_kb.embedding_dimension <= 0 THEN

        RAISE EXCEPTION
            'Knowledge Base v% memiliki embedding_dimension yang tidak valid: %.',
            target_kb.version,
            target_kb.embedding_dimension;

    END IF;


    -- ========================================================
    -- I. STORE PREVIOUS ACTIVE KB
    -- ========================================================

    SELECT id
    INTO previous_active_kb_id
    FROM public.knowledge_bases
    WHERE status = 'ACTIVE'
    LIMIT 1;


    -- ========================================================
    -- J. DEACTIVATE CURRENT ACTIVE KB
    -- ========================================================

    UPDATE public.knowledge_bases
    SET status = 'INACTIVE'
    WHERE status = 'ACTIVE'
      AND id <> target_kb_id;


    -- ========================================================
    -- K. ACTIVATE TARGET KB
    -- ========================================================

    UPDATE public.knowledge_bases
    SET
        status = 'ACTIVE',
        activated_at = NOW()
    WHERE id = target_kb_id
      AND status = 'READY';


    GET DIAGNOSTICS updated_rows = ROW_COUNT;


    IF updated_rows <> 1 THEN
        RAISE EXCEPTION
            'Gagal mengaktifkan Knowledge Base %. Expected 1 updated row, got %.',
            target_kb_id,
            updated_rows;
    END IF;


    -- ========================================================
    -- L. BUILD RESPONSE
    -- ========================================================

    result := jsonb_build_object(
        'success', true,
        'already_active', false,

        'kb_id', target_kb.id,
        'version', target_kb.version,
        'status', 'ACTIVE',

        'previous_active_kb_id', previous_active_kb_id,

        'document_count', document_count,
        'chunk_count', chunk_count,
        'embedding_count', embedding_count,

        'embedding_provider', target_kb.embedding_provider,
        'embedding_model', target_kb.embedding_model,
        'embedding_dimension', target_kb.embedding_dimension,

        'activated_at', NOW(),

        'message', format(
            'Knowledge Base v%s berhasil diaktifkan.',
            target_kb.version
        )
    );


    RETURN result;

END;
$$;


-- ============================================================
-- 5. FUNCTION SECURITY
-- ============================================================
-- Activation is an administrative operation.
--
-- Do not expose it directly to anon/authenticated browser
-- clients.
--
-- The Shrimpie backend should call this using the Supabase
-- service-role/admin client.
-- ============================================================

REVOKE ALL
ON FUNCTION public.activate_knowledge_base(UUID)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.activate_knowledge_base(UUID)
FROM anon;

REVOKE ALL
ON FUNCTION public.activate_knowledge_base(UUID)
FROM authenticated;

GRANT EXECUTE
ON FUNCTION public.activate_knowledge_base(UUID)
TO service_role;


-- ============================================================
-- 6. OPTIONAL COMMENT / DOCUMENTATION
-- ============================================================

COMMENT ON FUNCTION public.activate_knowledge_base(UUID)
IS
'Atomically activates a validated READY knowledge base. Prevents activation of empty/incomplete KBs, serializes concurrent activation, and maintains a single ACTIVE KB.';


-- ============================================================
-- 7. VERIFY FUNCTION
-- ============================================================

SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n
    ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'activate_knowledge_base';


-- ============================================================
-- 8. VERIFY ACTIVE KB INVARIANT
-- ============================================================

SELECT
    id,
    version,
    status,
    embedding_provider,
    embedding_model,
    embedding_dimension,
    activated_at
FROM public.knowledge_bases
WHERE status = 'ACTIVE';