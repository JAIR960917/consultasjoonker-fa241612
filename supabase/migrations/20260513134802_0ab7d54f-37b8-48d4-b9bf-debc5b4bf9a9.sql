DROP POLICY IF EXISTS contracts_admin_delete ON public.contracts;
CREATE POLICY contracts_admin_delete ON public.contracts FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

DROP POLICY IF EXISTS parcelas_admin_delete ON public.parcelas;
CREATE POLICY parcelas_admin_delete ON public.parcelas FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));