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
BEGIN
  -- medias.media_id
  SELECT COALESCE(MAX(media_id), 0) INTO _v FROM medias;
  PERFORM setval(pg_get_serial_sequence('medias','media_id'), _v, true);

  -- users.id
  SELECT COALESCE(MAX(id), 0) INTO _v FROM users;
  PERFORM setval(pg_get_serial_sequence('users','id'), _v, true);

  -- campaigns.campaign_id
  SELECT COALESCE(MAX(campaign_id), 0) INTO _v FROM campaigns;
  PERFORM setval(pg_get_serial_sequence('campaigns','campaign_id'), _v, true);

  -- playlists.playlist_id
  SELECT COALESCE(MAX(playlist_id), 0) INTO _v FROM playlists;
  PERFORM setval(pg_get_serial_sequence('playlists','playlist_id'), _v, true);

  -- playlist_items.item_id
  SELECT COALESCE(MAX(item_id), 0) INTO _v FROM playlist_items;
  PERFORM setval(pg_get_serial_sequence('playlist_items','item_id'), _v, true);

  -- totems.totem_id
  SELECT COALESCE(MAX(totem_id), 0) INTO _v FROM totems;
  PERFORM setval(pg_get_serial_sequence('totems','totem_id'), _v, true);

  -- smart_tvs.tv_id
  SELECT COALESCE(MAX(tv_id), 0) INTO _v FROM smart_tvs;
  PERFORM setval(pg_get_serial_sequence('smart_tvs','tv_id'), _v, true);

  -- subscribers.subscriber_id
  SELECT COALESCE(MAX(subscriber_id), 0) INTO _v FROM subscribers;
  PERFORM setval(pg_get_serial_sequence('subscribers','subscriber_id'), _v, true);

  -- publishers.publisher_id
  SELECT COALESCE(MAX(publisher_id), 0) INTO _v FROM publishers;
  PERFORM setval(pg_get_serial_sequence('publishers','publisher_id'), _v, true);

  -- locals.local_id
  SELECT COALESCE(MAX(local_id), 0) INTO _v FROM locals;
  PERFORM setval(pg_get_serial_sequence('locals','local_id'), _v, true);

  -- subscriber_contracts.contract_id
  SELECT COALESCE(MAX(contract_id), 0) INTO _v FROM subscriber_contracts;
  PERFORM setval(pg_get_serial_sequence('subscriber_contracts','contract_id'), _v, true);

  -- publisher_contracts.contract_id
  SELECT COALESCE(MAX(contract_id), 0) INTO _v FROM publisher_contracts;
  PERFORM setval(pg_get_serial_sequence('publisher_contracts','contract_id'), _v, true);

  -- subscriber_publisher_access.access_id
  SELECT COALESCE(MAX(access_id), 0) INTO _v FROM subscriber_publisher_access;
  PERFORM setval(pg_get_serial_sequence('subscriber_publisher_access','access_id'), _v, true);

  -- subscriptions.subscription_id
  SELECT COALESCE(MAX(subscription_id), 0) INTO _v FROM subscriptions;
  PERFORM setval(pg_get_serial_sequence('subscriptions','subscription_id'), _v, true);

  -- totem_playlists.totem_playlist_id
  SELECT COALESCE(MAX(totem_playlist_id), 0) INTO _v FROM totem_playlists;
  PERFORM setval(pg_get_serial_sequence('totem_playlists','totem_playlist_id'), _v, true);

  -- totem_playlist_items.item_id
  SELECT COALESCE(MAX(item_id), 0) INTO _v FROM totem_playlist_items;
  PERFORM setval(pg_get_serial_sequence('totem_playlist_items','item_id'), _v, true);

  -- dispatcher_logs.log_id
  SELECT COALESCE(MAX(log_id), 0) INTO _v FROM dispatcher_logs;
  PERFORM setval(pg_get_serial_sequence('dispatcher_logs','log_id'), _v, true);

  -- billing tables
  SELECT COALESCE(MAX(billing_id), 0) INTO _v FROM subscriber_billing;
  PERFORM setval(pg_get_serial_sequence('subscriber_billing','billing_id'), _v, true);

  SELECT COALESCE(MAX(billing_id), 0) INTO _v FROM publisher_billing;
  PERFORM setval(pg_get_serial_sequence('publisher_billing','billing_id'), _v, true);

  -- qr_codes.qr_code_id (se existir)
  IF to_regclass('qr_codes') IS NOT NULL THEN
    SELECT COALESCE(MAX(qr_code_id), 0) INTO _v FROM qr_codes;
    PERFORM setval(pg_get_serial_sequence('qr_codes','qr_code_id'), _v, true);
  END IF;
END $$;

