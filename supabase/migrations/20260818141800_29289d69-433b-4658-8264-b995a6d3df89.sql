-- Revoga permissão de execução pública para as novas funções SECURITY DEFINER
-- O linter avisou que usuários autenticados poderiam chamá-las (mesmo estando em esquemas públicos)
-- Já concedemos acesso ao service_role, então as Edge Functions continuarão funcionando.

REVOKE EXECUTE ON FUNCTION public.activate_license_device(uuid, text, text, text, text) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_approved_payment_bulk(uuid, jsonb) FROM PUBLIC, authenticated;

-- Re-garante para o service_role por segurança
GRANT EXECUTE ON FUNCTION public.activate_license_device(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_approved_payment_bulk(uuid, jsonb) TO service_role;
