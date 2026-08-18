-- 1. Hardening activate_license_device for better duration handling and security
CREATE OR REPLACE FUNCTION public.activate_license_device(
  p_license_id uuid,
  p_device_hash text,
  p_browser text,
  p_os text,
  p_ext_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_license public.licenses%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_device public.devices%ROWTYPE;
  v_duration_seconds bigint;
  v_max_devices integer;
  v_active_devices integer;
BEGIN
  IF p_device_hash IS NULL OR length(p_device_hash) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'invalid device hash' USING ERRCODE = '22023';
  END IF;

  -- Bloqueia a licença para evitar ativação dupla concorrente
  SELECT * INTO v_license FROM public.licenses WHERE id = p_license_id FOR UPDATE;
  IF v_license.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found', 'http_status', 404);
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_license.plan_id;
  
  IF v_license.status IN ('revoked', 'suspended', 'expired') THEN
    RETURN jsonb_build_object('valid', false, 'reason', v_license.status, 'http_status', 403);
  END IF;

  -- Se a licença ainda estiver pendente, calculamos a data de expiração agora (início do relógio)
  IF v_license.status = 'pending' THEN
    -- Ordem de precedência: Segundos Custom > Minutos Custom > Minutos Plano > Dias Plano
    v_duration_seconds := coalesce(
      v_license.custom_duration_seconds::bigint,
      v_license.custom_duration_minutes::bigint * 60,
      v_plan.duration_minutes::bigint * 60,
      v_plan.duration_days::bigint * 86400
    );
    
    IF v_duration_seconds IS NULL OR v_duration_seconds < 1 THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'error', 'message', 'A licença não possui uma duração válida para ativação.', 'http_status', 500);
    END IF;

    UPDATE public.licenses
    SET status = 'active',
        activated_at = now(),
        expires_at = now() + make_interval(secs => v_duration_seconds)
    WHERE id = v_license.id
    RETURNING * INTO v_license;
  END IF;

  -- Verifica se já expirou (relógio rodando)
  IF v_license.expires_at IS NOT NULL AND v_license.expires_at <= now() THEN
    UPDATE public.licenses SET status = 'expired' WHERE id = v_license.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'http_status', 403);
  END IF;

  -- Gestão de dispositivos
  v_max_devices := greatest(1, coalesce(v_license.max_devices_override, v_plan.max_devices, 1));
  SELECT * INTO v_device
  FROM public.devices
  WHERE license_id = v_license.id AND device_hash = p_device_hash;

  IF v_device.id IS NOT NULL AND v_device.is_revoked THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'device_mismatch', 'message', 'Dispositivo revogado', 'http_status', 403);
  ELSIF v_device.id IS NOT NULL THEN
    UPDATE public.devices
    SET last_seen_at = now(),
        browser = coalesce(p_browser, browser),
        os = coalesce(p_os, os),
        ext_version = coalesce(p_ext_version, ext_version)
    WHERE id = v_device.id;
  ELSE
    SELECT count(*)::integer INTO v_active_devices
    FROM public.devices
    WHERE license_id = v_license.id AND is_revoked = false;
    IF v_active_devices >= v_max_devices THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'device_limit', 'message', 'Limite de ' || v_max_devices || ' dispositivos atingido', 'http_status', 403);
    END IF;
    INSERT INTO public.devices (license_id, device_hash, browser, os, ext_version)
    VALUES (v_license.id, p_device_hash, p_browser, p_os, p_ext_version);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'user_id', v_license.user_id,
    'plan', coalesce(v_plan.slug, 'custom'),
    'plan_name', coalesce(v_plan.name, 'Personalizado'),
    'features', coalesce(v_plan.features, '[]'::jsonb),
    'expires_at', v_license.expires_at,
    'activated_at', v_license.activated_at,
    'max_devices', v_max_devices
  );
END;
$$;

-- 2. Hardening finalize_approved_payment_bulk to ensure plan_id and quantity consistency
CREATE OR REPLACE FUNCTION public.finalize_approved_payment_bulk(
  p_payment_id uuid,
  p_keys jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
  -- Bloqueia a linha do pagamento
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;

  IF v_payment.id IS NULL OR v_payment.status <> 'approved' THEN
    RETURN NULL;
  END IF;
  
  -- Garante que o plano existe
  SELECT * INTO v_plan FROM public.plans WHERE id = v_payment.plan_id;
  IF v_plan.id IS NULL THEN
     RAISE EXCEPTION 'plan not found for payment' USING ERRCODE = 'P0002';
  END IF;

  v_tag := 'pagamento ' || v_payment.id::text;

  -- Busca chaves já geradas (idempotência)
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

  -- Duração customizada (revendedores)
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

-- 3. Reposicionando GRANTS
GRANT EXECUTE ON FUNCTION public.activate_license_device(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_approved_payment_bulk(uuid, jsonb) TO service_role;
