-- =============================================================================
-- SmartSignage Pro - Fix sequences after manual ID inserts (seeds)
-- =============================================================================
-- When seeds insert explicit IDs into SERIAL columns, PostgreSQL sequences are NOT advanced.
-- This script aligns sequences with current MAX(id) to avoid "duplicate key violates ..._pkey".
--
-- Safe to run multiple times.

DO $$
DECLARE
  _v bigint;
  _seq text;
BEGIN
  -- Helper pattern:
  -- 1) check table exists
  -- 2) get sequence name (can be NULL if column isn't backed by a sequence)
  -- 3) setval to MAX(id)

  -- medias.media_id
  IF to_regclass('medias') IS NOT NULL THEN
    SELECT COALESCE(MAX(media_id), 0) INTO _v FROM medias;
    SELECT pg_get_serial_sequence('medias','media_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- users.id
  IF to_regclass('users') IS NOT NULL THEN
    SELECT COALESCE(MAX(id), 0) INTO _v FROM users;
    SELECT pg_get_serial_sequence('users','id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- campaigns.campaign_id
  IF to_regclass('campaigns') IS NOT NULL THEN
    SELECT COALESCE(MAX(campaign_id), 0) INTO _v FROM campaigns;
    SELECT pg_get_serial_sequence('campaigns','campaign_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- playlists.playlist_id
  IF to_regclass('playlists') IS NOT NULL THEN
    SELECT COALESCE(MAX(playlist_id), 0) INTO _v FROM playlists;
    SELECT pg_get_serial_sequence('playlists','playlist_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- playlist_items.item_id
  IF to_regclass('playlist_items') IS NOT NULL THEN
    SELECT COALESCE(MAX(item_id), 0) INTO _v FROM playlist_items;
    SELECT pg_get_serial_sequence('playlist_items','item_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- totems.totem_id
  IF to_regclass('totems') IS NOT NULL THEN
    SELECT COALESCE(MAX(totem_id), 0) INTO _v FROM totems;
    SELECT pg_get_serial_sequence('totems','totem_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- smart_tvs.tv_id
  IF to_regclass('smart_tvs') IS NOT NULL THEN
    SELECT COALESCE(MAX(tv_id), 0) INTO _v FROM smart_tvs;
    SELECT pg_get_serial_sequence('smart_tvs','tv_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- subscribers.subscriber_id
  IF to_regclass('subscribers') IS NOT NULL THEN
    SELECT COALESCE(MAX(subscriber_id), 0) INTO _v FROM subscribers;
    SELECT pg_get_serial_sequence('subscribers','subscriber_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- publishers.publisher_id
  IF to_regclass('publishers') IS NOT NULL THEN
    SELECT COALESCE(MAX(publisher_id), 0) INTO _v FROM publishers;
    SELECT pg_get_serial_sequence('publishers','publisher_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- locals.local_id
  IF to_regclass('locals') IS NOT NULL THEN
    SELECT COALESCE(MAX(local_id), 0) INTO _v FROM locals;
    SELECT pg_get_serial_sequence('locals','local_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- subscriber_contracts.contract_id
  IF to_regclass('subscriber_contracts') IS NOT NULL THEN
    SELECT COALESCE(MAX(contract_id), 0) INTO _v FROM subscriber_contracts;
    SELECT pg_get_serial_sequence('subscriber_contracts','contract_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- publisher_contracts.contract_id
  IF to_regclass('publisher_contracts') IS NOT NULL THEN
    SELECT COALESCE(MAX(contract_id), 0) INTO _v FROM publisher_contracts;
    SELECT pg_get_serial_sequence('publisher_contracts','contract_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- subscriber_publisher_access.access_id
  IF to_regclass('subscriber_publisher_access') IS NOT NULL THEN
    SELECT COALESCE(MAX(access_id), 0) INTO _v FROM subscriber_publisher_access;
    SELECT pg_get_serial_sequence('subscriber_publisher_access','access_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- subscriptions.subscription_id
  IF to_regclass('subscriptions') IS NOT NULL THEN
    SELECT COALESCE(MAX(subscription_id), 0) INTO _v FROM subscriptions;
    SELECT pg_get_serial_sequence('subscriptions','subscription_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- totem_playlists.totem_playlist_id
  IF to_regclass('totem_playlists') IS NOT NULL THEN
    SELECT COALESCE(MAX(totem_playlist_id), 0) INTO _v FROM totem_playlists;
    SELECT pg_get_serial_sequence('totem_playlists','totem_playlist_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- totem_playlist_items.item_id
  IF to_regclass('totem_playlist_items') IS NOT NULL THEN
    SELECT COALESCE(MAX(item_id), 0) INTO _v FROM totem_playlist_items;
    SELECT pg_get_serial_sequence('totem_playlist_items','item_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- dispatcher_logs.log_id (tabela pode não existir em todos os esquemas)
  IF to_regclass('dispatcher_logs') IS NOT NULL THEN
    SELECT COALESCE(MAX(log_id), 0) INTO _v FROM dispatcher_logs;
    SELECT pg_get_serial_sequence('dispatcher_logs','log_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- billing tables
  IF to_regclass('subscriber_billing') IS NOT NULL THEN
    SELECT COALESCE(MAX(billing_id), 0) INTO _v FROM subscriber_billing;
    SELECT pg_get_serial_sequence('subscriber_billing','billing_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  IF to_regclass('publisher_billing') IS NOT NULL THEN
    SELECT COALESCE(MAX(billing_id), 0) INTO _v FROM publisher_billing;
    SELECT pg_get_serial_sequence('publisher_billing','billing_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- qr_codes.qr_code_id (se existir)
  IF to_regclass('qr_codes') IS NOT NULL THEN
    SELECT COALESCE(MAX(qr_code_id), 0) INTO _v FROM qr_codes;
    SELECT pg_get_serial_sequence('qr_codes','qr_code_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;
END $$;

