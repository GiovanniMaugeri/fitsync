-- ==========================================
-- FITSYNC - FOODS: NOME ORIGINALE (alias di ricerca dopo una rinomina)
-- ==========================================

ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS original_name TEXT;
