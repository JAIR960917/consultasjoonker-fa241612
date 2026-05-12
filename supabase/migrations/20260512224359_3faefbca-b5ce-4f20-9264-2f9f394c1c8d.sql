ALTER TABLE public.branding ADD COLUMN IF NOT EXISTS boletos_info_text TEXT NOT NULL DEFAULT 'Os boletos serão gerados sempre no mesmo dia que o cliente escolheu anteriormente';

UPDATE public.branding b
SET boletos_info_text = s.boletos_info_text
FROM public.settings s
WHERE s.boletos_info_text IS NOT NULL AND s.boletos_info_text <> '';

ALTER TABLE public.settings DROP COLUMN IF EXISTS boletos_info_text;