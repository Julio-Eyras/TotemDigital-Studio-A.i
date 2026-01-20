-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 13: Dispatcher Views (Interface SQL estabilizada)
-- =============================================
--
-- Objetivo:
--  - Fornecer uma interface SQL estabilizada para o Dispatcher consumir
--  - Priorizar o "dispatcher burro": apenas SELECT por totem_id
--  - Fonte principal: totem_playlist_mix (mix atual) quando existir
--  - Fallback: totem_playlists + totem_playlist_items (playlist "gerada" legacy) quando NÃO existir mix atual
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
fallback_latest AS (
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
SELECT fr.*
FROM fallback_rows fr
WHERE NOT EXISTS (
    SELECT 1 FROM current_mix cm WHERE cm.totem_id = fr.totem_id
);

COMMENT ON VIEW v_dispatcher_resolved_playlist IS
    'Interface SQL estabilizada para o dispatcher: usa totem_playlist_mix (mix atual) e faz fallback para totem_playlists/totem_playlist_items quando não existir mix atual.';

