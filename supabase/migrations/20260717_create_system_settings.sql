-- =====================================================
-- Migration: Create System Settings Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated users
CREATE POLICY "Allow read for authenticated users" ON public.system_settings
    FOR SELECT TO authenticated USING (true);

-- Allow all actions for admin role
CREATE POLICY "Allow admin to manage system settings" ON public.system_settings
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- Prepopulate with default settings (so the admin doesn't start with empty fields)
INSERT INTO public.system_settings (key, value) VALUES
('llm_model', 'tencent/hy3:free'),
('embedding_model', 'openai/text-embedding-3-small'),
('llm_provider_url', 'https://openrouter.ai/api/v1'),
('embedding_provider_url', 'https://openrouter.ai/api/v1')
ON CONFLICT (key) DO NOTHING;
