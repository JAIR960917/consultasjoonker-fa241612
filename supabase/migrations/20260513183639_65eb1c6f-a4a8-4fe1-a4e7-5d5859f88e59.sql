
-- branding
DROP POLICY IF EXISTS branding_admin_insert ON public.branding;
DROP POLICY IF EXISTS branding_admin_update ON public.branding;
CREATE POLICY branding_admin_insert ON public.branding FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY branding_admin_update ON public.branding FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));

-- contract_template
DROP POLICY IF EXISTS contract_template_admin_insert ON public.contract_template;
DROP POLICY IF EXISTS contract_template_admin_update ON public.contract_template;
CREATE POLICY contract_template_admin_insert ON public.contract_template FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY contract_template_admin_update ON public.contract_template FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));

-- settings
DROP POLICY IF EXISTS settings_admin_insert ON public.settings;
DROP POLICY IF EXISTS settings_admin_update ON public.settings;
CREATE POLICY settings_admin_insert ON public.settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY settings_admin_update ON public.settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));

-- empresas
DROP POLICY IF EXISTS empresas_admin_delete ON public.empresas;
DROP POLICY IF EXISTS empresas_admin_insert ON public.empresas;
DROP POLICY IF EXISTS empresas_admin_update ON public.empresas;
CREATE POLICY empresas_admin_delete ON public.empresas FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY empresas_admin_insert ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY empresas_admin_update ON public.empresas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));

-- consultas
DROP POLICY IF EXISTS consultas_admin_delete ON public.consultas;
DROP POLICY IF EXISTS consultas_select_own_or_admin ON public.consultas;
CREATE POLICY consultas_admin_delete ON public.consultas FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY consultas_select_own_or_admin ON public.consultas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));

-- consultas_cache
DROP POLICY IF EXISTS consultas_cache_admin_delete ON public.consultas_cache;
CREATE POLICY consultas_cache_admin_delete ON public.consultas_cache FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));

-- consultas_pg_entrega
DROP POLICY IF EXISTS cpe_admin_delete ON public.consultas_pg_entrega;
CREATE POLICY cpe_admin_delete ON public.consultas_pg_entrega FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));

-- vendas
DROP POLICY IF EXISTS vendas_admin_delete ON public.vendas;
DROP POLICY IF EXISTS vendas_update_admin ON public.vendas;
CREATE POLICY vendas_admin_delete ON public.vendas FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY vendas_update_admin ON public.vendas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));

-- relatorios_diarios
DROP POLICY IF EXISTS relatorios_delete_admin ON public.relatorios_diarios;
DROP POLICY IF EXISTS relatorios_insert_admin_or_same_empresa ON public.relatorios_diarios;
DROP POLICY IF EXISTS relatorios_select_admin_or_same_empresa ON public.relatorios_diarios;
DROP POLICY IF EXISTS relatorios_update_admin_or_same_empresa ON public.relatorios_diarios;
CREATE POLICY relatorios_delete_admin ON public.relatorios_diarios FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
CREATE POLICY relatorios_insert_admin_or_same_empresa ON public.relatorios_diarios FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor') OR (has_role(auth.uid(),'gerente') AND empresa_id = current_user_empresa_id()));
CREATE POLICY relatorios_select_admin_or_same_empresa ON public.relatorios_diarios FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor') OR (has_role(auth.uid(),'gerente') AND empresa_id = current_user_empresa_id()));
CREATE POLICY relatorios_update_admin_or_same_empresa ON public.relatorios_diarios FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor') OR (has_role(auth.uid(),'gerente') AND empresa_id = current_user_empresa_id()));

-- cora_webhook_logs
DROP POLICY IF EXISTS cora_logs_admin_select ON public.cora_webhook_logs;
CREATE POLICY cora_logs_admin_select ON public.cora_webhook_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'desenvolvedor'));
