-- ==========================================
-- FITSYNC - FOODS: COLONNA BARCODE (scan codice a barre -> valori nutrizionali)
-- ==========================================

ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE INDEX IF NOT EXISTS idx_foods_barcode ON public.foods (barcode) WHERE barcode IS NOT NULL;
