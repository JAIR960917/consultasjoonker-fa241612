
CREATE TABLE public.consultas_pg_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cpf text NOT NULL,
  nome text,
  raw jsonb,
  cidade text NOT NULL DEFAULT '',
  empresa_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cpe_cpf ON public.consultas_pg_entrega(cpf);
CREATE INDEX idx_cpe_user ON public.consultas_pg_entrega(user_id);
CREATE INDEX idx_cpe_empresa ON public.consultas_pg_entrega(empresa_id);

ALTER TABLE public.consultas_pg_entrega ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpe_insert_self ON public.consultas_pg_entrega
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY cpe_select_own_admin_or_same_empresa ON public.consultas_pg_entrega
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'gerente'::app_role) AND empresa_id IS NOT NULL AND empresa_id = current_user_empresa_id())
  );

CREATE POLICY cpe_admin_delete ON public.consultas_pg_entrega
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
