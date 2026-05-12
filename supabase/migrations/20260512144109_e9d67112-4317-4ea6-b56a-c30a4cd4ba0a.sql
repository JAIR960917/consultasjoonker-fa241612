
CREATE TABLE public.contratos_assertiva (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id text NOT NULL UNIQUE,
  nome text,
  cpf text,
  status text,
  data_assinatura timestamptz,
  pdf_path text,
  raw jsonb,
  imported_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_assertiva ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_select_admin_dev" ON public.contratos_assertiva FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY "ca_insert_admin_dev" ON public.contratos_assertiva FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY "ca_update_admin_dev" ON public.contratos_assertiva FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY "ca_delete_admin_dev" ON public.contratos_assertiva FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));

CREATE INDEX idx_contratos_assertiva_cpf ON public.contratos_assertiva(cpf);

INSERT INTO storage.buckets (id, name, public) VALUES ('contratos-assertiva','contratos-assertiva', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ca_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='contratos-assertiva' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor')));
CREATE POLICY "ca_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='contratos-assertiva' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor')));
CREATE POLICY "ca_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='contratos-assertiva' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor')));
