-- =====================================================
-- Migration: Knowledge Base Version Deletion & Single ACTIVE Invariant
-- Ensures only one ACTIVE KB exists and provides a safe version-scoped deletion RPC.
-- =====================================================

-- 1. Single ACTIVE Invariant Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_bases_single_active
ON public.knowledge_bases(status)
WHERE status = 'ACTIVE';

-- 2. Version-Scoped Safe Deletion Stored Procedure
DROP FUNCTION IF EXISTS public.delete_knowledge_base_version(UUID);

CREATE OR REPLACE FUNCTION public.delete_knowledge_base_version(
    target_kb_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    target_kb public.knowledge_bases%ROWTYPE;
BEGIN
    -- Lock target KB record
    SELECT *
    INTO target_kb
    FROM public.knowledge_bases
    WHERE id = target_kb_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Knowledge Base dengan ID % tidak ditemukan.',
            target_kb_id;
    END IF;

    -- Reject deleting ACTIVE Knowledge Base
    IF target_kb.status = 'ACTIVE' THEN
        RAISE EXCEPTION
            'Knowledge Base v% sedang ACTIVE dan tidak dapat dihapus. Aktifkan versi lain terlebih dahulu.',
            target_kb.version;
    END IF;

    -- Reject deleting protected Knowledge Base
    IF (target_kb.metadata->>'is_protected')::boolean = true THEN
        RAISE EXCEPTION
            'Knowledge Base v% dilindungi (is_protected = true) dan tidak dapat dihapus.',
            target_kb.version;
    END IF;

    -- Delete Knowledge Base record (child rows cascade)
    DELETE FROM public.knowledge_bases
    WHERE id = target_kb_id;

    RETURN jsonb_build_object(
        'success', true,
        'kb_id', target_kb_id,
        'version', target_kb.version,
        'previous_status', target_kb.status
    );
END;
$$;

-- Security Hardening on delete_knowledge_base_version RPC
REVOKE ALL ON FUNCTION public.delete_knowledge_base_version(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_knowledge_base_version(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.delete_knowledge_base_version(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_knowledge_base_version(UUID) TO service_role;
