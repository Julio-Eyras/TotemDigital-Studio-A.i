-- Compat: screenshots remotos + colunas de admin remota em bases já instaladas
-- Idempotente. Aplicar após part3/part6 ou em upgrades.

ALTER TABLE IF EXISTS totems ADD COLUMN IF NOT EXISTS player_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS totems ADD COLUMN IF NOT EXISTS now_playing JSONB;

CREATE TABLE IF NOT EXISTS remote_screenshots (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    command_id INTEGER,
    file_path TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    format TEXT DEFAULT 'png',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_remote_screenshots_totem_created
    ON remote_screenshots (totem_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_remote_screenshots_totem'
  ) THEN
    ALTER TABLE remote_screenshots
      ADD CONSTRAINT fk_remote_screenshots_totem
      FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'fk_remote_screenshots_totem: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_remote_screenshots_command'
  ) THEN
    ALTER TABLE remote_screenshots
      ADD CONSTRAINT fk_remote_screenshots_command
      FOREIGN KEY (command_id) REFERENCES remote_commands(command_id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'fk_remote_screenshots_command: %', SQLERRM;
END $$;
