
CREATE TABLE IF NOT EXISTS public.empresa_credenciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE,
  cora_client_id text,
  cora_certificate text,
  cora_private_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_credenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creds_select_admin_or_dev"
ON public.empresa_credenciais FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "creds_insert_admin_or_dev"
ON public.empresa_credenciais FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "creds_update_admin_or_dev"
ON public.empresa_credenciais FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "creds_delete_admin_or_dev"
ON public.empresa_credenciais FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE TRIGGER trg_empresa_credenciais_updated
BEFORE UPDATE ON public.empresa_credenciais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
