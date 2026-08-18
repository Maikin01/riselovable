CREATE OR REPLACE FUNCTION public.finalize_approved_payment_bulk(
  p_payment_id uuid,
  p_keys jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_tag text;
  v_existing text[];
  v_needed integer;
  v_item jsonb;
  v_license_id uuid;
  v_first uuid;
  v_minutes integer;
  i integer;
BEGIN
  -- Bloqueia a linha do pagamento para evitar geração duplicada em concorrência
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;

  IF v_payment.id IS NULL OR v_payment.status <> 'approved' THEN
    RETURN NULL;
  END IF;
  
  -- Recupera o plano para garantir que temos o ID correto
  SELECT * INTO v_plan FROM public.plans WHERE id = v_payment.plan_id;

  v_tag := 'pagamento ' || v_payment.id::text;

  -- Busca chaves já geradas para este pagamento para garantir idempotência
  SELECT array_agg(l.license_key ORDER BY l.created_at)
    INTO v_existing
  FROM public.licenses AS l
  WHERE l.notes LIKE '%' || v_tag || '%';

  IF v_existing IS NULL AND v_payment.license_id IS NOT NULL THEN
    SELECT array_agg(l.license_key)
      INTO v_existing
    FROM public.licenses AS l
    WHERE l.id = v_payment.license_id;
  END IF;

  v_needed := GREATEST(0, COALESCE(v_payment.quantity, 1) - COALESCE(array_length(v_existing, 1), 0));

  -- Se for uma licença de revenda com duração customizada
  IF v_payment.custom_duration_days IS NOT NULL AND v_payment.custom_duration_days > 0 THEN
    v_minutes := v_payment.custom_duration_days * 1440;
  ELSE
    v_minutes := NULL;
  END IF;

  FOR i IN 1..v_needed LOOP
    v_item := p_keys -> (i - 1);
    EXIT WHEN v_item IS NULL;

    INSERT INTO public.licenses (
      user_id, 
      plan_id, 
      license_key, 
      license_key_hash,
      status, 
      activated_at, 
      expires_at, 
      custom_duration_minutes, 
      notes
    )
    VALUES (
      v_payment.user_id,
      v_payment.plan_id,
      v_item ->> 'key',
      v_item ->> 'hash',
      'pending',
      NULL,
      NULL,
      v_minutes,
      'Pix MP ' || COALESCE(v_payment.provider_payment_id, '') ||
        ' — ' || v_tag ||
        ' — ' || COALESCE(v_payment.buyer_name, '') ||
        ' (' || COALESCE(v_payment.buyer_whatsapp, '') || ')'
    )
    RETURNING id INTO v_license_id;

    v_existing := COALESCE(v_existing, ARRAY[]::text[]) || (v_item ->> 'key');
    IF v_first IS NULL THEN
      v_first := v_license_id;
    END IF;
  END LOOP;

  UPDATE public.payments
  SET license_id = COALESCE(license_id, v_first),
      paid_at = COALESCE(paid_at, now())
  WHERE id = p_payment_id;

  RETURN to_jsonb(COALESCE(v_existing, ARRAY[]::text[]));
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_approved_payment_bulk(uuid, jsonb) TO service_role;
