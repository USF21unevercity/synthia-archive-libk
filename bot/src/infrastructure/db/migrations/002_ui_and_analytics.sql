-- Additive only: no existing table is altered or renamed.

CREATE TABLE IF NOT EXISTS bot_users (
  telegram_user_id TEXT PRIMARY KEY,
  full_name        TEXT,
  username         TEXT,
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_views (
  id               BIGSERIAL PRIMARY KEY,
  file_id          BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  viewer_telegram_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_views_file ON file_views (file_id);
CREATE INDEX IF NOT EXISTS idx_file_views_created ON file_views (created_at DESC);
