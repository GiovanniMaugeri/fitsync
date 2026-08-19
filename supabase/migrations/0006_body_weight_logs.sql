-- ==========================================
-- FITSYNC - BODY_WEIGHT_LOGS: peso corporeo giornaliero
-- ==========================================

CREATE TABLE IF NOT EXISTS public.body_weight_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight_kg NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, date)
);

ALTER TABLE public.body_weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own body weight logs" ON public.body_weight_logs;
CREATE POLICY "Users can manage own body weight logs"
    ON public.body_weight_logs FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
