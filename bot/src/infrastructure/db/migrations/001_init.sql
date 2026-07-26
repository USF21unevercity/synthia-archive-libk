-- Module: core schema (channels, admins, RBAC, files, archive, hashtags, logs)

CREATE TABLE IF NOT EXISTS channels (
    id                  BIGSERIAL PRIMARY KEY,
    telegram_channel_id TEXT        NOT NULL UNIQUE,
    title               TEXT        NOT NULL,
    username            TEXT,
    archive_channel_id  TEXT,
    status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'disabled')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channels_status ON channels (status);

CREATE TABLE IF NOT EXISTS admins (
    id               BIGSERIAL PRIMARY KEY,
    telegram_user_id TEXT        NOT NULL UNIQUE,
    full_name        TEXT,
    username         TEXT,
    role             TEXT        NOT NULL DEFAULT 'admin'
                     CHECK (role IN ('owner', 'admin', 'moderator', 'viewer')),
    is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_role ON admins (role);

CREATE TABLE IF NOT EXISTS admin_channels (
    admin_id   BIGINT      NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
    channel_id BIGINT      NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (admin_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_channels_channel ON admin_channels (channel_id);

CREATE TABLE IF NOT EXISTS files (
    id                      BIGSERIAL PRIMARY KEY,
    channel_id              BIGINT      NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    message_id              BIGINT      NOT NULL,
    telegram_file_id        TEXT,
    telegram_file_unique_id TEXT,
    content_type            TEXT        NOT NULL DEFAULT 'other',
    title                   TEXT,
    caption                 TEXT,
    subject                 TEXT,
    category                TEXT,
    file_name               TEXT,
    mime_type               TEXT,
    file_size               BIGINT,
    link_url                TEXT,
    published_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_files_channel_message UNIQUE (channel_id, message_id)
);

-- Duplicate protection for Telegram file identity
CREATE UNIQUE INDEX IF NOT EXISTS uq_files_file_unique_id
    ON files (telegram_file_unique_id)
    WHERE telegram_file_unique_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_files_channel      ON files (channel_id);
CREATE INDEX IF NOT EXISTS idx_files_content_type ON files (content_type);
CREATE INDEX IF NOT EXISTS idx_files_subject      ON files (subject);
CREATE INDEX IF NOT EXISTS idx_files_category     ON files (category);
CREATE INDEX IF NOT EXISTS idx_files_published_at ON files (published_at DESC);

-- High-performance full text search over title / caption / subject / category
CREATE INDEX IF NOT EXISTS idx_files_search ON files
    USING GIN (to_tsvector('simple',
        COALESCE(title, '') || ' ' ||
        COALESCE(caption, '') || ' ' ||
        COALESCE(subject, '') || ' ' ||
        COALESCE(category, '') || ' ' ||
        COALESCE(file_name, '')));

CREATE TABLE IF NOT EXISTS archive_logs (
    id                 BIGSERIAL PRIMARY KEY,
    file_id            BIGINT      NOT NULL REFERENCES files (id) ON DELETE CASCADE,
    archive_channel_id TEXT        NOT NULL,
    archive_message_id BIGINT,
    status             TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'archived', 'failed')),
    error_message      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archive_logs_file   ON archive_logs (file_id);
CREATE INDEX IF NOT EXISTS idx_archive_logs_status ON archive_logs (status);

CREATE TABLE IF NOT EXISTS hashtags (
    id          BIGSERIAL PRIMARY KEY,
    tag         TEXT   NOT NULL UNIQUE,
    usage_count BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS file_hashtags (
    file_id    BIGINT NOT NULL REFERENCES files (id) ON DELETE CASCADE,
    hashtag_id BIGINT NOT NULL REFERENCES hashtags (id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS idx_file_hashtags_hashtag ON file_hashtags (hashtag_id);

CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id                BIGSERIAL PRIMARY KEY,
    actor_telegram_id TEXT,
    action            TEXT        NOT NULL,
    entity_type       TEXT,
    entity_id         TEXT,
    details           JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor   ON activity_logs (actor_telegram_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs (created_at DESC);
