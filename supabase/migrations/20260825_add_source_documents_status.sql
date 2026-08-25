-- =====================================================
-- Migration: Add status column to source_documents table
-- =====================================================

ALTER TABLE public.source_documents 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'READY';
