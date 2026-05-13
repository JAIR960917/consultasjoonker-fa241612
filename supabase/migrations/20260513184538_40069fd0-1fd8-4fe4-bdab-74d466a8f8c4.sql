DROP POLICY IF EXISTS contracts_select_own_admin_or_same_empresa ON public.contracts;
CREATE POLICY contracts_select_own_admin_or_same_empresa
ON public.contracts
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR (
    has_role(auth.uid(), 'gerente'::app_role)
    AND empresa_id IS NOT NULL
    AND empresa_id = current_user_empresa_id()
  )
);

DROP POLICY IF EXISTS contracts_update_own_admin_or_same_empresa ON public.contracts;
CREATE POLICY contracts_update_own_admin_or_same_empresa
ON public.contracts
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR (
    has_role(auth.uid(), 'gerente'::app_role)
    AND empresa_id IS NOT NULL
    AND empresa_id = current_user_empresa_id()
  )
);

DROP POLICY IF EXISTS parcelas_select_own_admin_or_same_empresa ON public.parcelas;
CREATE POLICY parcelas_select_own_admin_or_same_empresa
ON public.parcelas
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR (
    has_role(auth.uid(), 'gerente'::app_role)
    AND empresa_id IS NOT NULL
    AND empresa_id = current_user_empresa_id()
  )
);

DROP POLICY IF EXISTS parcelas_update_own_admin_or_same_empresa ON public.parcelas;
CREATE POLICY parcelas_update_own_admin_or_same_empresa
ON public.parcelas
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR (
    has_role(auth.uid(), 'gerente'::app_role)
    AND empresa_id IS NOT NULL
    AND empresa_id = current_user_empresa_id()
  )
);

DROP POLICY IF EXISTS vendas_select_own_admin_or_same_empresa ON public.vendas;
CREATE POLICY vendas_select_own_admin_or_same_empresa
ON public.vendas
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR (
    has_role(auth.uid(), 'gerente'::app_role)
    AND empresa_id IS NOT NULL
    AND empresa_id = current_user_empresa_id()
  )
);

DROP POLICY IF EXISTS consultas_pg_entrega_select_own_admin_or_same_empresa ON public.consultas_pg_entrega;
DROP POLICY IF EXISTS cpe_select_own_admin_or_same_empresa ON public.consultas_pg_entrega;
CREATE POLICY cpe_select_own_admin_or_same_empresa
ON public.consultas_pg_entrega
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR (
    has_role(auth.uid(), 'gerente'::app_role)
    AND empresa_id IS NOT NULL
    AND empresa_id = current_user_empresa_id()
  )
);