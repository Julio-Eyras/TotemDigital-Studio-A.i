-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 17: Procedures atómicas (publisher e subscriber com recursos)
-- Regra: contract_number gerado no banco como PUB-{publisher_id}.{seq} / SUB-{subscriber_id}.{seq}
-- =============================================

-- =============================================
-- create_publisher_with_resources
-- Cria publisher, locals, totems, smart_tvs e publisher_contracts numa única transação.
-- contract_number é sempre gerado no banco: PUB-{publisher_id}.{seq} (seq 000001, 000002, ...)
-- =============================================
CREATE OR REPLACE FUNCTION create_publisher_with_resources(
  p_publisher jsonb,
  p_locals jsonb DEFAULT '[]'::jsonb,
  p_totems jsonb DEFAULT '[]'::jsonb,
  p_smart_tvs jsonb DEFAULT '[]'::jsonb,
  p_contracts jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_publisher_id integer;
  v_local_ids integer[] := '{}';
  v_totem_ids integer[] := '{}';
  v_local_id integer;
  v_totem_id integer;
  v_loc jsonb;
  v_t jsonb;
  v_s jsonb;
  v_c jsonb;
  v_idx integer;
  v_local_index integer;
  v_totem_index integer;
  v_seq integer := 0;
  v_contract_number text;
  v_result jsonb;
BEGIN
  -- 1. Inserir publisher
  INSERT INTO publishers (name, contact_name, email, phone, whatsapp, category_segment, description, is_subscriber, is_publisher, client_type, is_active, created_at, updated_at)
  VALUES (
    COALESCE(p_publisher->>'name', ''),
    p_publisher->>'contact_name',
    p_publisher->>'email',
    p_publisher->>'phone',
    p_publisher->>'whatsapp',
    p_publisher->>'category_segment',
    p_publisher->>'description',
    false,
    true,
    'publisher',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  RETURNING publisher_id INTO v_publisher_id;

  IF v_publisher_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao inserir publisher';
  END IF;

  -- 2. Locals
  FOR v_idx IN 0 .. (jsonb_array_length(p_locals) - 1) LOOP
    v_loc := p_locals->v_idx;
    INSERT INTO locals (publisher_id, name, category_segment, address, city, state, zip_code, country, latitude, longitude, timezone, description, is_active, created_at, updated_at)
    VALUES (
      v_publisher_id,
      COALESCE(v_loc->>'name', ''),
      v_loc->>'category_segment',
      v_loc->>'address',
      v_loc->>'city',
      v_loc->>'state',
      v_loc->>'zip_code',
      v_loc->>'country',
      (NULLIF(TRIM(COALESCE(v_loc->>'latitude', '')), ''))::real,
      (NULLIF(TRIM(COALESCE(v_loc->>'longitude', '')), ''))::real,
      COALESCE(v_loc->>'timezone', 'America/Sao_Paulo'),
      v_loc->>'description',
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING local_id INTO v_local_id;
    v_local_ids := array_append(v_local_ids, v_local_id);
  END LOOP;

  -- 3. Totems (cada um referencia local por localIndex: 0-based no payload; array PostgreSQL é 1-based)
  FOR v_idx IN 0 .. (jsonb_array_length(p_totems) - 1) LOOP
    v_t := p_totems->v_idx;
    v_local_index := COALESCE((NULLIF(TRIM(COALESCE(v_t->>'localIndex', '')), ''))::integer, 0);
    v_local_id := NULL;
    IF array_length(v_local_ids, 1) IS NOT NULL AND v_local_index >= 0 AND v_local_index < array_length(v_local_ids, 1) THEN
      v_local_id := v_local_ids[v_local_index + 1];
    ELSIF array_length(v_local_ids, 1) >= 1 THEN
      v_local_id := v_local_ids[1];
    END IF;

    INSERT INTO totems (identifier, uin, device_id, local_id, name, description, model, manufacturer, firmware_version, hardware_version, os_version, status, last_heartbeat, heartbeat_interval, network_info, capabilities, is_active, created_at, updated_at)
    VALUES (
      v_t->>'identifier',
      v_t->>'uin',
      v_t->>'deviceId',
      v_local_id,
      v_t->>'name',
      v_t->>'description',
      v_t->>'model',
      v_t->>'manufacturer',
      v_t->>'firmwareVersion',
      v_t->>'hardwareVersion',
      v_t->>'osVersion',
      COALESCE(v_t->>'status', 'offline'),
      NULL,
      60,
      COALESCE(v_t->'network_info', '{}'::jsonb),
      COALESCE(v_t->'capabilities', '{}'::jsonb),
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING totem_id INTO v_totem_id;
    v_totem_ids := array_append(v_totem_ids, v_totem_id);
  END LOOP;

  -- 4. Smart TVs (totemIndex 0-based no payload; array PostgreSQL 1-based)
  FOR v_idx IN 0 .. (jsonb_array_length(p_smart_tvs) - 1) LOOP
    v_s := p_smart_tvs->v_idx;
    v_totem_index := COALESCE((NULLIF(TRIM(COALESCE(v_s->>'totemIndex', '')), ''))::integer, 0);
    v_totem_id := NULL;
    IF array_length(v_totem_ids, 1) IS NOT NULL AND v_totem_index >= 0 AND v_totem_index < array_length(v_totem_ids, 1) THEN
      v_totem_id := v_totem_ids[v_totem_index + 1];
    ELSIF array_length(v_totem_ids, 1) >= 1 THEN
      v_totem_id := v_totem_ids[1];
    END IF;

    INSERT INTO smart_tvs (totem_id, identifier, device_id, name, brand, model, platform, firmware_version, resolution_width, resolution_height, orientation, status, last_heartbeat, capabilities, settings, is_active, created_at, updated_at)
    VALUES (
      v_totem_id,
      COALESCE(v_s->>'identifier', ''),
      v_s->>'device_id',
      v_s->>'name',
      v_s->>'brand',
      v_s->>'model',
      v_s->>'platform',
      v_s->>'firmware_version',
      (NULLIF(TRIM(COALESCE(v_s->>'resolution_width', '')), ''))::integer,
      (NULLIF(TRIM(COALESCE(v_s->>'resolution_height', '')), ''))::integer,
      COALESCE(v_s->>'orientation', 'landscape'),
      COALESCE(v_s->>'status', 'offline'),
      NULL,
      COALESCE(v_s->'capabilities', '{}'::jsonb),
      COALESCE(v_s->'settings', '{}'::jsonb),
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  END LOOP;

  -- 5. Publisher contracts: contract_number gerado no banco = PUB-{publisher_id}.{seq}
  -- Casts seguros: start_date NOT NULL (default CURRENT_DATE se vazio); end_date e numéricos aceitam NULL/'' sem exceção
  FOR v_idx IN 0 .. (jsonb_array_length(p_contracts) - 1) LOOP
    v_c := p_contracts->v_idx;
    v_seq := v_seq + 1;
    v_contract_number := 'PUB-' || v_publisher_id || '.' || lpad(v_seq::text, 6, '0');

    INSERT INTO publisher_contracts (publisher_id, contract_number, contract_type, title, description, start_date, end_date, revenue_share_percentage, revenue_share_rules, minimum_payout_amount, subscription_amount, subscription_interval, currency, payment_terms, status, signed_by_publisher_at, signed_by_tenant_at, created_by, metadata, document_path, document_filename, document_mime_type, document_size_bytes, is_active, created_at, updated_at)
    VALUES (
      v_publisher_id,
      v_contract_number,
      COALESCE(v_c->>'contract_type', 'revenue_share'),
      COALESCE(v_c->>'title', ''),
      v_c->>'description',
      COALESCE((NULLIF(TRIM(COALESCE(v_c->>'start_date', '')), ''))::date, CURRENT_DATE),
      (NULLIF(TRIM(COALESCE(v_c->>'end_date', '')), ''))::date,
      COALESCE((NULLIF(TRIM(COALESCE(v_c->>'revenue_share_percentage', '')), ''))::numeric, 0),
      COALESCE(v_c->'revenue_share_rules', '{}'::jsonb),
      (NULLIF(TRIM(COALESCE(v_c->>'minimum_payout_amount', '')), ''))::numeric,
      (NULLIF(TRIM(COALESCE(v_c->>'subscription_amount', '')), ''))::numeric,
      v_c->>'subscription_interval',
      COALESCE(v_c->>'currency', 'BRL'),
      COALESCE(v_c->>'payment_terms', 'Mensal'),
      COALESCE(v_c->>'status', 'draft'),
      NULL,
      NULL,
      (NULLIF(TRIM(COALESCE(v_c->>'created_by', '')), ''))::integer,
      COALESCE(v_c->'metadata', '{}'::jsonb),
      v_c->>'document_path',
      v_c->>'document_filename',
      v_c->>'document_mime_type',
      (NULLIF(TRIM(COALESCE(v_c->>'document_size_bytes', '')), ''))::bigint,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  END LOOP;

  v_result := jsonb_build_object(
    'publisher_id', v_publisher_id,
    'local_ids', (SELECT jsonb_agg(x) FROM unnest(v_local_ids) AS x),
    'totem_ids', (SELECT jsonb_agg(x) FROM unnest(v_totem_ids) AS x)
  );
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION create_publisher_with_resources(jsonb, jsonb, jsonb, jsonb, jsonb) IS 'Criação atómica de publisher com locals, totems, smart_tvs e contratos. contract_number gerado como PUB-{publisher_id}.{seq}';

-- =============================================
-- create_subscriber_with_contracts
-- Cria subscriber e subscriber_contracts numa única transação.
-- contract_number é sempre gerado no banco: SUB-{subscriber_id}.{seq}
-- =============================================
CREATE OR REPLACE FUNCTION create_subscriber_with_contracts(
  p_subscriber jsonb,
  p_contracts jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_subscriber_id integer;
  v_c jsonb;
  v_idx integer;
  v_seq integer := 0;
  v_contract_number text;
  v_result jsonb;
BEGIN
  -- 1. Inserir subscriber
  INSERT INTO subscribers (name, contact_name, email, phone, whatsapp, address, category_segment, description, is_active, created_at, updated_at)
  VALUES (
    COALESCE(p_subscriber->>'name', ''),
    p_subscriber->>'contact_name',
    p_subscriber->>'email',
    p_subscriber->>'phone',
    p_subscriber->>'whatsapp',
    p_subscriber->>'address',
    p_subscriber->>'category_segment',
    p_subscriber->>'description',
    COALESCE((p_subscriber->>'is_active')::boolean, true),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  RETURNING subscriber_id INTO v_subscriber_id;

  IF v_subscriber_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao inserir subscriber';
  END IF;

  -- 2. Subscriber contracts: contract_number gerado no banco = SUB-{subscriber_id}.{seq}
  -- Casts seguros para datas e numéricos (evitar exceção com string vazia)
  FOR v_idx IN 0 .. (jsonb_array_length(p_contracts) - 1) LOOP
    v_c := p_contracts->v_idx;
    v_seq := v_seq + 1;
    v_contract_number := 'SUB-' || v_subscriber_id || '.' || lpad(v_seq::text, 6, '0');

    INSERT INTO subscriber_contracts (subscriber_id, plan_id, contract_number, contract_type, title, description, start_date, end_date, total_amount, currency, payment_terms, status, signed_by_subscriber_at, signed_by_tenant_at, created_by, metadata, document_path, document_filename, document_mime_type, document_size_bytes, is_active, created_at, updated_at)
    VALUES (
      v_subscriber_id,
      (NULLIF(TRIM(COALESCE(v_c->>'plan_id', '')), ''))::integer,
      v_contract_number,
      COALESCE(v_c->>'contract_type', 'advertising'),
      COALESCE(v_c->>'title', ''),
      v_c->>'description',
      COALESCE((NULLIF(TRIM(COALESCE(v_c->>'start_date', '')), ''))::date, CURRENT_DATE),
      (NULLIF(TRIM(COALESCE(v_c->>'end_date', '')), ''))::date,
      (NULLIF(TRIM(COALESCE(v_c->>'total_amount', '')), ''))::numeric,
      COALESCE(v_c->>'currency', 'BRL'),
      v_c->>'payment_terms',
      COALESCE(v_c->>'status', 'draft'),
      (NULLIF(TRIM(COALESCE(v_c->>'signed_by_subscriber_at', '')), ''))::timestamp,
      (NULLIF(TRIM(COALESCE(v_c->>'signed_by_tenant_at', '')), ''))::timestamp,
      (NULLIF(TRIM(COALESCE(v_c->>'created_by', '')), ''))::integer,
      COALESCE(v_c->'metadata', '{}'::jsonb),
      v_c->>'document_path',
      v_c->>'document_filename',
      v_c->>'document_mime_type',
      (NULLIF(TRIM(COALESCE(v_c->>'document_size_bytes', '')), ''))::bigint,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  END LOOP;

  v_result := jsonb_build_object('subscriber_id', v_subscriber_id);
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION create_subscriber_with_contracts(jsonb, jsonb) IS 'Criação atómica de subscriber com contratos. contract_number gerado como SUB-{subscriber_id}.{seq}';
