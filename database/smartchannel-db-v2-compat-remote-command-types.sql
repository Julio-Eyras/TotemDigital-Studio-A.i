-- Compatibilidade: tipos de comando remoto alinhados ao backend (Player-AD / painel Totens).
-- Idempotente. Corrige instalações onde chk_remote_command_type não inclui refresh_dispatch, etc.
ALTER TABLE IF EXISTS remote_commands DROP CONSTRAINT IF EXISTS chk_remote_command_type;
ALTER TABLE IF EXISTS remote_commands ADD CONSTRAINT chk_remote_command_type
    CHECK (command_type IN (
        'restart', 'restart_app', 'reboot', 'reset_board',
        'screenshot', 'capture_screen',
        'invalidate_media', 'invalidate_playlist', 'invalidate_campaign',
        'refresh_dispatch', 'sync_now', 'content_version_check',
        'purge_cache', 'clear_cache',
        'update', 'config', 'apply_player_config', 'ota_rollback', 'custom',
        'play', 'pause', 'load_playlist', 'request_playlist', 'ping'
    ));
