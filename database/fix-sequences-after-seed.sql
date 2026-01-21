-- ==============================================================================
-- SmartSignage Pro - Corrigir sequências após inserções manuais de IDs (seeds)
-- =============================================================================
-- Quando seeds inserem IDs explícitos em colunas SERIAL, as sequências do PostgreSQL NÃO são avançadas.
-- Este script alinha as sequências com o MAX(id) atual para evitar "chave duplicada viola ..._pkey".
--
-- Pode ser executado várias vezes sem problemas.

DO $$
DECLARE
  _v bigint;
  _seq text;
BEGIN
-- Padrão auxiliar: 
-- 1) a tabela de verificação existe 
-- 2) obter o nome da sequência (pode ser NULL se a coluna não for apoiada por uma sequência) 
-- 3) setval to MAX(id) ou 1 se não houver registros (setval não aceita 0)

  -- medias.media_id
  IF to_regclass('medias') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(media_id), 0), 1) INTO _v FROM medias;
    SELECT pg_get_serial_sequence('medias','media_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- users.id
  IF to_regclass('users') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(id), 0), 1) INTO _v FROM users;
    SELECT pg_get_serial_sequence('users','id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- campaigns.campaign_id
  IF to_regclass('campaigns') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(campaign_id), 0), 1) INTO _v FROM campaigns;
    SELECT pg_get_serial_sequence('campaigns','campaign_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- playlists.playlist_id
  IF to_regclass('playlists') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(playlist_id), 0), 1) INTO _v FROM playlists;
    SELECT pg_get_serial_sequence('playlists','playlist_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- playlist_items.item_id
  IF to_regclass('playlist_items') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(item_id), 0), 1) INTO _v FROM playlist_items;
    SELECT pg_get_serial_sequence('playlist_items','item_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- totems.totem_id
  IF to_regclass('totems') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(totem_id), 0), 1) INTO _v FROM totems;
    SELECT pg_get_serial_sequence('totems','totem_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- smart_tvs.smart_tv_id
  IF to_regclass('smart_tvs') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(smart_tv_id), 0), 1) INTO _v FROM smart_tvs;
    SELECT pg_get_serial_sequence('smart_tvs','smart_tv_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- subscribers.subscriber_id
  IF to_regclass('subscribers') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(subscriber_id), 0), 1) INTO _v FROM subscribers;
    SELECT pg_get_serial_sequence('subscribers','subscriber_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- publishers.publisher_id
  IF to_regclass('publishers') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(publisher_id), 0), 1) INTO _v FROM publishers;
    SELECT pg_get_serial_sequence('publishers','publisher_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- locals.local_id
  IF to_regclass('locals') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(local_id), 0), 1) INTO _v FROM locals;
    SELECT pg_get_serial_sequence('locals','local_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- subscriber_contracts.contract_id
  IF to_regclass('subscriber_contracts') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(contract_id), 0), 1) INTO _v FROM subscriber_contracts;
    SELECT pg_get_serial_sequence('subscriber_contracts','contract_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- publisher_contracts.contract_id
  IF to_regclass('publisher_contracts') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(contract_id), 0), 1) INTO _v FROM publisher_contracts;
    SELECT pg_get_serial_sequence('publisher_contracts','contract_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- subscriber_publisher_access.access_id
  IF to_regclass('subscriber_publisher_access') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(access_id), 0), 1) INTO _v FROM subscriber_publisher_access;
    SELECT pg_get_serial_sequence('subscriber_publisher_access','access_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- subscriptions.subscription_id
  IF to_regclass('subscriptions') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(subscription_id), 0), 1) INTO _v FROM subscriptions;
    SELECT pg_get_serial_sequence('subscriptions','subscription_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- totem_playlists.totem_playlist_id
  IF to_regclass('totem_playlists') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(totem_playlist_id), 0), 1) INTO _v FROM totem_playlists;
    SELECT pg_get_serial_sequence('totem_playlists','totem_playlist_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- totem_playlist_items.item_id
  IF to_regclass('totem_playlist_items') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(item_id), 0), 1) INTO _v FROM totem_playlist_items;
    SELECT pg_get_serial_sequence('totem_playlist_items','item_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;
  -- totem_playlist_mix.mix_id
  IF to_regclass('totem_playlist_mix') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(mix_id), 0), 1) INTO _v FROM totem_playlist_mix;
    SELECT pg_get_serial_sequence('totem_playlist_mix','mix_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;
  -- playlist_mix_history.history_id
  IF to_regclass('playlist_mix_history') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(history_id), 0), 1) INTO _v FROM playlist_mix_history;
    SELECT pg_get_serial_sequence('playlist_mix_history','history_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;
  -- playlist_mix_rules.rule_id
  IF to_regclass('playlist_mix_rules') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(rule_id), 0), 1) INTO _v FROM playlist_mix_rules;
    SELECT pg_get_serial_sequence('playlist_mix_rules','rule_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;
  -- ai_context_data.context_id
  IF to_regclass('ai_context_data') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(context_id), 0), 1) INTO _v FROM ai_context_data;
    SELECT pg_get_serial_sequence('ai_context_data','context_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- dispatcher_log.log_id (nome correto no schema v2 refatorado)
  IF to_regclass('dispatcher_log') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(log_id), 0), 1) INTO _v FROM dispatcher_log;
    SELECT pg_get_serial_sequence('dispatcher_log','log_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- audit_logs.id (evita duplicate key em auditoria após seed com IDs explícitos)
  IF to_regclass('audit_logs') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(id), 0), 1) INTO _v FROM audit_logs;
    SELECT pg_get_serial_sequence('audit_logs','id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- billing tables
  IF to_regclass('subscriber_billing') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(billing_id), 0), 1) INTO _v FROM subscriber_billing;
    SELECT pg_get_serial_sequence('subscriber_billing','billing_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  IF to_regclass('publisher_billing') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(billing_id), 0), 1) INTO _v FROM publisher_billing;
    SELECT pg_get_serial_sequence('publisher_billing','billing_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- qr_codes (schema v2 usa qr_id; schemas antigos podem usar qr_code_id)
  IF to_regclass('qr_codes') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'qr_codes'
        AND column_name = 'qr_id'
    ) THEN
      SELECT GREATEST(COALESCE(MAX(qr_id), 0), 1) INTO _v FROM qr_codes;
      SELECT pg_get_serial_sequence('qr_codes','qr_id') INTO _seq;
      IF _seq IS NOT NULL THEN
        PERFORM setval(_seq, _v, true);
      END IF;
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'qr_codes'
        AND column_name = 'qr_code_id'
    ) THEN
      SELECT GREATEST(COALESCE(MAX(qr_code_id), 0), 1) INTO _v FROM qr_codes;
      SELECT pg_get_serial_sequence('qr_codes','qr_code_id') INTO _seq;
      IF _seq IS NOT NULL THEN
        PERFORM setval(_seq, _v, true);
      END IF;
    END IF;
  END IF;

  -- webhooks.id (CORRIGIDO: usar GREATEST para evitar erro quando tabela está vazia)
  IF to_regclass('webhooks') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(id), 0), 1) INTO _v FROM webhooks;
    SELECT pg_get_serial_sequence('webhooks','id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- alerts.alert_id
  IF to_regclass('alerts') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(alert_id), 0), 1) INTO _v FROM alerts;
    SELECT pg_get_serial_sequence('alerts','alert_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- event_logs.id
  IF to_regclass('event_logs') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(id), 0), 1) INTO _v FROM event_logs;
    SELECT pg_get_serial_sequence('event_logs','id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- notifications.notification_id
  IF to_regclass('notifications') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(notification_id), 0), 1) INTO _v FROM notifications;
    SELECT pg_get_serial_sequence('notifications','notification_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- plans.plan_id
  IF to_regclass('plans') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(plan_id), 0), 1) INTO _v FROM plans;
    SELECT pg_get_serial_sequence('plans','plan_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- reports.report_id
  IF to_regclass('reports') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(report_id), 0), 1) INTO _v FROM reports;
    SELECT pg_get_serial_sequence('reports','report_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- dashboard_layouts.layout_id
  IF to_regclass('dashboard_layouts') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(layout_id), 0), 1) INTO _v FROM dashboard_layouts;
    SELECT pg_get_serial_sequence('dashboard_layouts','layout_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- backups.backup_id
  IF to_regclass('backups') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(backup_id), 0), 1) INTO _v FROM backups;
    SELECT pg_get_serial_sequence('backups','backup_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- tags.tag_id
  IF to_regclass('tags') IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(tag_id), 0), 1) INTO _v FROM tags;
    SELECT pg_get_serial_sequence('tags','tag_id') INTO _seq;
    IF _seq IS NOT NULL THEN
      PERFORM setval(_seq, _v, true);
    END IF;
  END IF;

  -- campaign_publishers.id (pode não ter sequence, mas verificar)
  IF to_regclass('campaign_publishers') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaign_publishers' AND column_name = 'id'
    ) THEN
      SELECT GREATEST(COALESCE(MAX(id), 0), 1) INTO _v FROM campaign_publishers;
      SELECT pg_get_serial_sequence('campaign_publishers','id') INTO _seq;
      IF _seq IS NOT NULL THEN
        PERFORM setval(_seq, _v, true);
      END IF;
    END IF;
  END IF;

  -- campaign_playlists.id
  IF to_regclass('campaign_playlists') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaign_playlists' AND column_name = 'id'
    ) THEN
      SELECT GREATEST(COALESCE(MAX(id), 0), 1) INTO _v FROM campaign_playlists;
      SELECT pg_get_serial_sequence('campaign_playlists','id') INTO _seq;
      IF _seq IS NOT NULL THEN
        PERFORM setval(_seq, _v, true);
      END IF;
    END IF;
  END IF;

  -- campaign_medias.id
  IF to_regclass('campaign_medias') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaign_medias' AND column_name = 'id'
    ) THEN
      SELECT GREATEST(COALESCE(MAX(id), 0), 1) INTO _v FROM campaign_medias;
      SELECT pg_get_serial_sequence('campaign_medias','id') INTO _seq;
      IF _seq IS NOT NULL THEN
        PERFORM setval(_seq, _v, true);
      END IF;
    END IF;
  END IF;

  -- campaign_totems.id
  IF to_regclass('campaign_totems') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaign_totems' AND column_name = 'id'
    ) THEN
      SELECT GREATEST(COALESCE(MAX(id), 0), 1) INTO _v FROM campaign_totems;
      SELECT pg_get_serial_sequence('campaign_totems','id') INTO _seq;
      IF _seq IS NOT NULL THEN
        PERFORM setval(_seq, _v, true);
      END IF;
    END IF;
  END IF;
END $$;

