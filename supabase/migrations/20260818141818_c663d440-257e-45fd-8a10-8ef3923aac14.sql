-- Re-aplicando REVOKE explicitamente para garantir que o linter pare de reclamar.
-- Postgres pode manter permissões residuais se o objeto for recriado.

REVOKE ALL ON FUNCTION public.activate_license_device(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_approved_payment_bulk(uuid, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.activate_license_device(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_approved_payment_bulk(uuid, jsonb) TO service_role;
