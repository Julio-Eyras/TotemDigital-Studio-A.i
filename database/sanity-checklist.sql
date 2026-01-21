-- =========================================================
-- SmartSignage Pro - Sanity Checklist (SQL)
-- Objetivo: detectar registros FORA do modelo de domínio.
-- Esperado: todas as queries de "INCONSISTÊNCIA" retornam 0 linhas.
--
-- Como usar (exemplo):
--   psql -d smartsignage -f database/sanity-checklist.sql
--
-- Data: 2026-01-19
-- =========================================================

\echo '========================================='
\echo ' SmartSignage - SANITY CHECKLIST (SQL)'
\echo '========================================='
\echo ''

-- =========================================================
-- 0) Resumo rápido (contagens básicas)
-- =========================================================
\echo '[0] Contagens básicas'
SELECT 'subscribers' AS table, COUNT(*) AS total FROM subscribers
UNION ALL SELECT 'publishers', COUNT(*) FROM publishers
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'locals', COUNT(*) FROM locals
UNION ALL SELECT 'totems', COUNT(*) FROM totems
UNION ALL SELECT 'smart_tvs', COUNT(*) FROM smart_tvs
UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL SELECT 'medias', COUNT(*) FROM medias
UNION ALL SELECT 'playlists', COUNT(*) FROM playlists
UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions;
\echo ''

-- =========================================================
-- 1) USERS - regras tenant vs publisher_user vs subscriber_user
-- =========================================================
\echo '[1] USERS - inconsistências (esperado: 0 linhas)'

-- 1.1 Tenant user deve ter publisher_id/subscriber_id NULL e user_type=system_user
SELECT
  u.id, u.username, u.user_type, u.is_tenant_user, u.publisher_id, u.subscriber_id
FROM users u
WHERE u.is_tenant_user = true
  AND (u.publisher_id IS NOT NULL OR u.subscriber_id IS NOT NULL OR u.user_type <> 'system_user');

-- 1.2 Não-tenant deve ter EXATAMENTE um vínculo e user_type coerente
SELECT
  u.id, u.username, u.user_type, u.is_tenant_user, u.publisher_id, u.subscriber_id
FROM users u
WHERE u.is_tenant_user = false
  AND (
    (u.publisher_id IS NULL AND u.subscriber_id IS NULL)
    OR (u.publisher_id IS NOT NULL AND u.subscriber_id IS NOT NULL)
    OR (u.publisher_id IS NOT NULL AND u.user_type <> 'publisher_user')
    OR (u.subscriber_id IS NOT NULL AND u.user_type <> 'subscriber_user')
  );

-- 1.3 FK sanity: publisher_id/subscriber_id deve existir na tabela correspondente
SELECT u.id, u.username, u.publisher_id
FROM users u
LEFT JOIN publishers p ON p.publisher_id = u.publisher_id
WHERE u.publisher_id IS NOT NULL AND p.publisher_id IS NULL;

SELECT u.id, u.username, u.subscriber_id
FROM users u
LEFT JOIN subscribers s ON s.subscriber_id = u.subscriber_id
WHERE u.subscriber_id IS NOT NULL AND s.subscriber_id IS NULL;
\echo ''

-- =========================================================
-- 2) PUBLISHERS - devem ser publisher-only (client_type fixo)
-- =========================================================
\echo '[2] PUBLISHERS - inconsistências (esperado: 0 linhas)'
SELECT
  p.publisher_id, p.name, p.client_type, p.is_publisher, p.is_subscriber, p.active
FROM publishers p
WHERE NOT (
  p.client_type = 'publisher'
  AND p.is_publisher = true
  AND p.is_subscriber = false
);
\echo ''

-- =========================================================
-- 3) Locals/Totems/Smart TVs - pertencem a publisher (via locals)
-- =========================================================
\echo '[3] Locals/Totems/Smart TVs - inconsistências (esperado: 0 linhas)'

-- 3.1 locals.publisher_id deve existir
SELECT l.local_id, l.name, l.publisher_id
FROM locals l
LEFT JOIN publishers p ON p.publisher_id = l.publisher_id
WHERE p.publisher_id IS NULL;

-- 3.2 totems.local_id deve existir
SELECT t.totem_id, t.identifier, t.local_id
FROM totems t
LEFT JOIN locals l ON l.local_id = t.local_id
WHERE l.local_id IS NULL;

-- 3.3 smart_tvs.totem_id deve existir
SELECT tv.smart_tv_id, tv.identifier, tv.totem_id
FROM smart_tvs tv
LEFT JOIN totems t ON t.totem_id = tv.totem_id
WHERE t.totem_id IS NULL;
\echo ''

-- =========================================================
-- 4) Campanhas/Mídias/Playlists - pertencem a subscriber
-- =========================================================
\echo '[4] Campaigns/Medias/Playlists - inconsistências (esperado: 0 linhas)'

-- 4.1 campaigns.subscriber_id deve existir
SELECT c.campaign_id, c.title, c.subscriber_id, c.status, c.is_active
FROM campaigns c
LEFT JOIN subscribers s ON s.subscriber_id = c.subscriber_id
WHERE s.subscriber_id IS NULL;

-- 4.2 medias.subscriber_id deve existir
SELECT m.media_id, m.name, m.subscriber_id, m.status, m.is_active
FROM medias m
LEFT JOIN subscribers s ON s.subscriber_id = m.subscriber_id
WHERE s.subscriber_id IS NULL;

-- 4.3 playlists.subscriber_id deve existir
SELECT pl.playlist_id, pl.name, pl.subscriber_id, pl.is_active
FROM playlists pl
LEFT JOIN subscribers s ON s.subscriber_id = pl.subscriber_id
WHERE s.subscriber_id IS NULL;
\echo ''

-- =========================================================
-- 5) N:N - coerência de "mesmo subscriber" onde aplicável
-- =========================================================
\echo '[5] Relacionamentos - inconsistências (esperado: 0 linhas)'

-- 5.1 campaign_playlists: campanha e playlist devem ser do MESMO subscriber
SELECT cp.campaign_id, cp.playlist_id,
       c.subscriber_id AS campaign_subscriber_id,
       pl.subscriber_id AS playlist_subscriber_id
FROM campaign_playlists cp
JOIN campaigns c ON c.campaign_id = cp.campaign_id
JOIN playlists pl ON pl.playlist_id = cp.playlist_id
WHERE c.subscriber_id <> pl.subscriber_id;

-- 5.2 campaign_medias: campanha e mídia devem ser do MESMO subscriber
SELECT cm.campaign_id, cm.media_id,
       c.subscriber_id AS campaign_subscriber_id,
       m.subscriber_id AS media_subscriber_id
FROM campaign_medias cm
JOIN campaigns c ON c.campaign_id = cm.campaign_id
JOIN medias m ON m.media_id = cm.media_id
WHERE c.subscriber_id <> m.subscriber_id;

-- 5.3 playlist_items: playlist e media devem ser do MESMO subscriber (se existir tabela)
SELECT
  pi.playlist_id, pi.media_id,
  pl.subscriber_id AS playlist_subscriber_id,
  m.subscriber_id AS media_subscriber_id
FROM playlist_items pi
JOIN playlists pl ON pl.playlist_id = pi.playlist_id
JOIN medias m ON m.media_id = pi.media_id
WHERE pl.subscriber_id <> m.subscriber_id;
\echo ''

-- =========================================================
-- 6) SUBSCRIPTIONS - apenas publishers
-- =========================================================
\echo '[6] Subscriptions - inconsistências (esperado: 0 linhas)'

-- 6.1 subscriptions.publisher_id deve existir e referenciar publisher (não subscriber)
SELECT s.subscription_id, s.publisher_id
FROM subscriptions s
LEFT JOIN publishers p ON p.publisher_id = s.publisher_id
WHERE p.publisher_id IS NULL;

-- 6.2 subscriptions.plan_id deve existir
SELECT s.subscription_id, s.plan_id
FROM subscriptions s
LEFT JOIN plans p ON p.plan_id = s.plan_id
WHERE p.plan_id IS NULL;

-- 6.3 status deve estar no conjunto permitido (defesa extra)
SELECT subscription_id, status
FROM subscriptions
WHERE status NOT IN ('active', 'cancelled', 'past_due', 'unpaid', 'trialing', 'paused');
\echo ''

-- =========================================================
-- 7) Acessos subscriber→publisher (existe no schema v2)
-- =========================================================
\echo '[7] subscriber_publisher_access - inconsistências (esperado: 0 linhas)'
SELECT spa.access_id, spa.subscriber_id, spa.publisher_id, spa.is_active
FROM subscriber_publisher_access spa
LEFT JOIN subscribers s ON s.subscriber_id = spa.subscriber_id
LEFT JOIN publishers p ON p.publisher_id = spa.publisher_id
WHERE s.subscriber_id IS NULL OR p.publisher_id IS NULL;

-- Datas invertidas (quando existir expires_at)
SELECT spa.access_id, spa.subscriber_id, spa.publisher_id, spa.granted_at, spa.expires_at
FROM subscriber_publisher_access spa
WHERE spa.expires_at IS NOT NULL AND spa.granted_at IS NOT NULL AND spa.granted_at > spa.expires_at;

-- revoked_at antes de granted_at (violação)
SELECT spa.access_id, spa.subscriber_id, spa.publisher_id, spa.granted_at, spa.revoked_at
FROM subscriber_publisher_access spa
WHERE spa.revoked_at IS NOT NULL AND spa.granted_at IS NOT NULL AND spa.revoked_at < spa.granted_at;
\echo ''

\echo '========================================='
\echo ' FIM - Sanity Checklist'
\echo '========================================='

