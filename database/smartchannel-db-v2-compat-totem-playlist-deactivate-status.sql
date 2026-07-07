-- Compat: cascade_totem_deactivate usava status 'inactive' (inválido em chk_totem_playlist_status).
-- Valores permitidos: active, paused, invalidated.
CREATE OR REPLACE FUNCTION cascade_totem_deactivate()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_active = true AND NEW.is_active = false THEN
        UPDATE smart_tvs SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE totem_id = NEW.totem_id AND is_active = true;
        UPDATE totem_playlists SET is_active = false, status = 'invalidated', updated_at = CURRENT_TIMESTAMP
            WHERE totem_id = NEW.totem_id AND is_active = true;
        UPDATE campaign_totems SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE totem_id = NEW.totem_id AND is_active = true;
        IF to_regclass('public.playlist_mix_rules') IS NOT NULL THEN
            UPDATE playlist_mix_rules SET is_active = false, updated_at = CURRENT_TIMESTAMP
                WHERE totem_id = NEW.totem_id AND is_active = true;
        END IF;
        IF to_regclass('public.totem_playlist_mix') IS NOT NULL THEN
            UPDATE totem_playlist_mix SET is_active = false, updated_at = CURRENT_TIMESTAMP
                WHERE totem_id = NEW.totem_id AND is_active = true;
        END IF;
        IF to_regclass('public.ai_context_data') IS NOT NULL THEN
            UPDATE ai_context_data SET is_active = false, updated_at = CURRENT_TIMESTAMP
                WHERE totem_id = NEW.totem_id AND is_active = true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
