-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 13: Dispatcher Views (Interface SQL estabilizada)
-- =============================================
--
-- Objetivo:
--  - Fornecer uma interface SQL estabilizada para o Dispatcher consumir
--  - Priorizar o "dispatcher burro": apenas SELECT por totem_id
--  - Fonte principal: totem_playlist_mix (mix atual) quando existir
--  - Fallback: "single campaign winner" (calculado via campaigns/campaign_totems/campaign_playlists/playlist_items)
--              quando NÃO existir mix atual
--  - Último fallback (defensivo): totem_playlists + totem_playlist_items (playlist "gerada" legacy)
--                                quando NÃO existir mix atual e NÃO houver campanha vencedora
--
-- Importante:
--  - Esta parte deve ser aplicada APÓS Parte 11/12 (tabelas/funções de mix), pois referencia totem_playlist_mix.

-- =============================================
-- VIEW: v_dispatcher_resolved_playlist
-- =============================================
-- Retorna uma "playlist resolvida" por totem_id.
-- O consumer pode filtrar assim:
--   SELECT * FROM v_dispatcher_resolved_playlist WHERE totem_id = 1 ORDER BY order_index;

CREATE OR REPLACE VIEW v_dispatcher_resolved_playlist AS
WITH totem_ctx AS (
    SELECT
        t.totem_id,
        l.publisher_id
    FROM totems t
    JOIN locals l ON l.local_id = t.local_id
),
current_mix AS (
    SELECT
        m.totem_id,
        m.mix_id,
        m.mix_version,
        m.mix_strategy,
        m.mix_items,
        m.generated_at,
        m.applied_at
    FROM totem_playlist_mix m
    WHERE m.is_active = true
      AND m.is_current = true
),
mix_rows AS (
    SELECT
        cm.totem_id,
        tc.publisher_id,
        'mix'::text AS resolved_source,
        (mi->>'source')::text AS item_source,
        cm.mix_id,
        cm.mix_version,
        cm.mix_strategy,
        cm.generated_at,
        cm.applied_at,
        -- Campos base do item (podem vir incompletos dependendo do gerador)
        NULLIF(mi->>'campaign_id','')::int AS campaign_id,
        NULLIF(mi->>'playlist_id','')::int AS playlist_id,
        COALESCE(
            NULLIF(mi->>'subscriber_id','')::int,
            c.subscriber_id
        ) AS subscriber_id,
        NULLIF(mi->>'media_id','')::int AS media_id,
        COALESCE(
            NULLIF(mi->>'order_index','')::int,
            (ordinality - 1)
        ) AS order_index,
        COALESCE(
            NULLIF(mi->>'display_seconds','')::int,
            NULLIF(mi->>'duration','')::int,
            pi.display_seconds,
            md.duration_seconds,
            10
        ) AS display_seconds,
        COALESCE(
            NULLIF(mi->>'priority','')::int,
            c.priority,
            1
        ) AS priority,
        mi AS item_json,
        md.name AS media_name,
        md.media_type,
        md.mime_type,
        md.file_path,
        md.file_name,
        md.thumbnail_url,
        md.preview_url
    FROM current_mix cm
    JOIN totem_ctx tc ON tc.totem_id = cm.totem_id
    CROSS JOIN LATERAL jsonb_array_elements(cm.mix_items) WITH ORDINALITY AS x(mi, ordinality)
    LEFT JOIN campaigns c
      ON c.campaign_id = NULLIF(mi->>'campaign_id','')::int
    LEFT JOIN playlist_items pi
      ON pi.playlist_id = NULLIF(mi->>'playlist_id','')::int
     AND pi.media_id = NULLIF(mi->>'media_id','')::int
     AND pi.is_active = true
    LEFT JOIN medias md
      ON md.media_id = NULLIF(mi->>'media_id','')::int
),
winner_campaign AS (
    -- 1 campanha vencedora por totem, com filtros mínimos (status/ativo/tempo/acesso/contrato)
    SELECT DISTINCT ON (tc.totem_id)
        tc.totem_id,
        tc.publisher_id,
        c.campaign_id,
        c.subscriber_id,
        COALESCE(ct.priority, c.priority, 1) AS effective_priority,
        COALESCE(cp.time_share_percent, c.default_time_share_percent, 0) AS effective_time_share_percent
    FROM totem_ctx tc
    JOIN campaign_totems ct
      ON ct.totem_id = tc.totem_id
     AND ct.is_active = true
    JOIN campaigns c
      ON c.campaign_id = ct.campaign_id
     AND c.is_active = true
     AND c.status = 'active'
    JOIN campaign_publishers cp
      ON cp.campaign_id = c.campaign_id
     AND cp.publisher_id = tc.publisher_id
     AND cp.is_active = true
    JOIN subscriber_publisher_access_active spa
      ON spa.subscriber_id = c.subscriber_id
     AND spa.publisher_id = tc.publisher_id
    LEFT JOIN subscriber_contracts sc
      ON sc.contract_id = c.contract_id
    WHERE
        (COALESCE(ct.start_date, c.start_date) IS NULL OR COALESCE(ct.start_date, c.start_date) <= CURRENT_TIMESTAMP)
        AND (COALESCE(ct.end_date, c.end_date) IS NULL OR COALESCE(ct.end_date, c.end_date) >= CURRENT_TIMESTAMP)
        AND (
            COALESCE(ct.start_time, c.start_time) IS NULL
            OR COALESCE(ct.end_time, c.end_time) IS NULL
            OR to_char(CURRENT_TIMESTAMP, 'HH24:MI') BETWEEN COALESCE(ct.start_time, c.start_time) AND COALESCE(ct.end_time, c.end_time)
        )
        AND (
            COALESCE(ct.days_of_week, c.days_of_week) IS NULL
            OR (COALESCE(ct.days_of_week, c.days_of_week))::jsonb ? trim(lower(to_char(CURRENT_TIMESTAMP, 'Day')))
            OR (COALESCE(ct.days_of_week, c.days_of_week))::jsonb ? lower(to_char(CURRENT_TIMESTAMP, 'Dy'))
        )
        AND (
            c.contract_id IS NULL
            OR (
                sc.status = 'active'
                AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
                AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
            )
        )
    ORDER BY
        tc.totem_id,
        COALESCE(ct.priority, c.priority, 1) DESC,
        COALESCE(cp.time_share_percent, c.default_time_share_percent, 0) DESC,
        c.campaign_id ASC
),
winner_with_playlist AS (
    SELECT DISTINCT ON (w.totem_id)
        w.totem_id,
        w.publisher_id,
        w.campaign_id,
        w.subscriber_id,
        cpl.playlist_id
    FROM winner_campaign w
    LEFT JOIN campaign_playlists cpl
      ON cpl.campaign_id = w.campaign_id
     AND cpl.is_active = true
    ORDER BY
        w.totem_id,
        cpl.priority DESC NULLS LAST,
        cpl.playlist_id ASC
),
winner_rows_playlist AS (
    SELECT
        wp.totem_id,
        wp.publisher_id,
        'single_winner'::text AS resolved_source,
        'campaign_playlist'::text AS item_source,
        NULL::int AS mix_id,
        NULL::int AS mix_version,
        NULL::text AS mix_strategy,
        CURRENT_TIMESTAMP AS generated_at,
        NULL::timestamp AS applied_at,
        wp.campaign_id,
        wp.playlist_id,
        wp.subscriber_id,
        pi.media_id,
        pi.order_index,
        COALESCE(pi.display_seconds, md.duration_seconds, 10) AS display_seconds,
        1::int AS priority,
        NULL::jsonb AS item_json,
        md.name AS media_name,
        md.media_type,
        md.mime_type,
        md.file_path,
        md.file_name,
        md.thumbnail_url,
        md.preview_url
    FROM winner_with_playlist wp
    JOIN playlist_items pi
      ON pi.playlist_id = wp.playlist_id
     AND pi.is_active = true
    LEFT JOIN medias md
      ON md.media_id = pi.media_id
    WHERE wp.playlist_id IS NOT NULL
),
winner_rows_direct AS (
    SELECT
        wp.totem_id,
        wp.publisher_id,
        'single_winner'::text AS resolved_source,
        'campaign_medias'::text AS item_source,
        NULL::int AS mix_id,
        NULL::int AS mix_version,
        NULL::text AS mix_strategy,
        CURRENT_TIMESTAMP AS generated_at,
        NULL::timestamp AS applied_at,
        wp.campaign_id,
        NULL::int AS playlist_id,
        wp.subscriber_id,
        cm.media_id,
        cm.order_index,
        COALESCE(cm.display_seconds, md.duration_seconds, 10) AS display_seconds,
        COALESCE(cm.priority, 1) AS priority,
        NULL::jsonb AS item_json,
        md.name AS media_name,
        md.media_type,
        md.mime_type,
        md.file_path,
        md.file_name,
        md.thumbnail_url,
        md.preview_url
    FROM winner_with_playlist wp
    JOIN campaign_medias cm
      ON cm.campaign_id = wp.campaign_id
     AND cm.is_active = true
    LEFT JOIN medias md
      ON md.media_id = cm.media_id
    WHERE wp.playlist_id IS NULL
),
winner_rows AS (
    SELECT * FROM winner_rows_playlist
    UNION ALL
    SELECT * FROM winner_rows_direct
),
fallback_latest AS (
    -- fallback defensivo: playlist gerada, apenas se NÃO houver campanha vencedora
    SELECT DISTINCT ON (tp.totem_id)
        tp.totem_id,
        tp.publisher_id,
        p.totem_playlist_id,
        p.smart_tv_id,
        p.generated_at,
        p.last_updated_at,
        p.version
    FROM totem_ctx tp
    JOIN totem_playlists p
      ON p.totem_id = tp.totem_id
    WHERE p.is_active = true
      AND p.status = 'active'
    ORDER BY
        tp.totem_id,
        COALESCE(p.last_updated_at, p.generated_at) DESC,
        p.version DESC
),
fallback_rows AS (
    SELECT
        fl.totem_id,
        fl.publisher_id,
        'fallback_totem_playlists'::text AS resolved_source,
        'totem_playlist'::text AS item_source,
        NULL::int AS mix_id,
        NULL::int AS mix_version,
        NULL::text AS mix_strategy,
        COALESCE(fl.last_updated_at, fl.generated_at) AS generated_at,
        NULL::timestamp AS applied_at,
        tpi.campaign_id,
        NULL::int AS playlist_id,
        tpi.subscriber_id,
        tpi.media_id,
        tpi.order_index,
        tpi.display_seconds,
        tpi.priority,
        NULL::jsonb AS item_json,
        md.name AS media_name,
        md.media_type,
        md.mime_type,
        md.file_path,
        md.file_name,
        md.thumbnail_url,
        md.preview_url
    FROM fallback_latest fl
    JOIN totem_playlist_items tpi
      ON tpi.totem_playlist_id = fl.totem_playlist_id
     AND tpi.is_active = true
    LEFT JOIN medias md
      ON md.media_id = tpi.media_id
)
SELECT *
FROM mix_rows
UNION ALL
SELECT wr.*
FROM winner_rows wr
WHERE NOT EXISTS (
    SELECT 1 FROM current_mix cm WHERE cm.totem_id = wr.totem_id
)
UNION ALL
SELECT fr.*
FROM fallback_rows fr
WHERE NOT EXISTS (
    SELECT 1 FROM current_mix cm WHERE cm.totem_id = fr.totem_id
)
AND NOT EXISTS (
    SELECT 1 FROM winner_campaign w WHERE w.totem_id = fr.totem_id
);

COMMENT ON VIEW v_dispatcher_resolved_playlist IS
    'Interface SQL estabilizada para o dispatcher: usa totem_playlist_mix (mix atual); fallback calcula 1 campanha vencedora quando não houver mix; último fallback usa totem_playlists/totem_playlist_items.';

