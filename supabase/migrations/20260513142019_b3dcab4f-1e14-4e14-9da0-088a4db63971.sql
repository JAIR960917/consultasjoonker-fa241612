ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS cora_interest_monthly_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cora_fine_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cora_discount_percent numeric NOT NULL DEFAULT 0;