-- RSA — Schema completo para Supabase (PostgreSQL)
-- Pega este script en Supabase > SQL Editor > New query y ejecuta.

-- ─── Laravel internals ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS migrations (
    id        SERIAL PRIMARY KEY,
    migration VARCHAR(255) NOT NULL,
    batch     INTEGER      NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id                BIGSERIAL PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    email             VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at TIMESTAMP    NULL,
    password          VARCHAR(255) NOT NULL,
    remember_token    VARCHAR(100) NULL,
    created_at        TIMESTAMP    NULL,
    updated_at        TIMESTAMP    NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    email      VARCHAR(255) PRIMARY KEY,
    token      VARCHAR(255) NOT NULL,
    created_at TIMESTAMP    NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id            VARCHAR(255) PRIMARY KEY,
    user_id       BIGINT       NULL REFERENCES users (id),
    ip_address    VARCHAR(45)  NULL,
    user_agent    TEXT         NULL,
    payload       TEXT         NOT NULL,
    last_activity INTEGER      NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx       ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_last_activity_idx ON sessions (last_activity);

CREATE TABLE IF NOT EXISTS cache (
    key        VARCHAR(255) PRIMARY KEY,
    value      TEXT         NOT NULL,
    expiration INTEGER      NOT NULL
);

CREATE TABLE IF NOT EXISTS cache_locks (
    key        VARCHAR(255) PRIMARY KEY,
    owner      VARCHAR(255) NOT NULL,
    expiration INTEGER      NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
    id           BIGSERIAL    PRIMARY KEY,
    queue        VARCHAR(255) NOT NULL,
    payload      TEXT         NOT NULL,
    attempts     SMALLINT     NOT NULL,
    reserved_at  INTEGER      NULL,
    available_at INTEGER      NOT NULL,
    created_at   INTEGER      NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_queue_idx ON jobs (queue);

CREATE TABLE IF NOT EXISTS job_batches (
    id              VARCHAR(255) PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    total_jobs      INTEGER      NOT NULL,
    pending_jobs    INTEGER      NOT NULL,
    failed_jobs     INTEGER      NOT NULL,
    failed_job_ids  TEXT         NOT NULL,
    options         TEXT         NULL,
    cancelled_at    INTEGER      NULL,
    created_at      INTEGER      NOT NULL,
    finished_at     INTEGER      NULL
);

CREATE TABLE IF NOT EXISTS failed_jobs (
    id         BIGSERIAL    PRIMARY KEY,
    uuid       VARCHAR(255) NOT NULL UNIQUE,
    connection TEXT         NOT NULL,
    queue      TEXT         NOT NULL,
    payload    TEXT         NOT NULL,
    exception  TEXT         NOT NULL,
    failed_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS personal_access_tokens (
    id             BIGSERIAL    PRIMARY KEY,
    tokenable_type VARCHAR(255) NOT NULL,
    tokenable_id   BIGINT       NOT NULL,
    name           VARCHAR(255) NOT NULL,
    token          VARCHAR(64)  NOT NULL UNIQUE,
    abilities      TEXT         NULL,
    last_used_at   TIMESTAMP    NULL,
    expires_at     TIMESTAMP    NULL,
    created_at     TIMESTAMP    NULL,
    updated_at     TIMESTAMP    NULL
);
CREATE INDEX IF NOT EXISTS pat_tokenable_idx
    ON personal_access_tokens (tokenable_type, tokenable_id);

-- ─── RSA ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incidents (
    id                          BIGSERIAL       PRIMARY KEY,
    title                       VARCHAR(160)    NOT NULL,
    type                        VARCHAR(40)     NOT NULL,
    severity                    VARCHAR(40)     NOT NULL,
    description                 TEXT            NULL,
    latitude                    DECIMAL(10, 7)  NOT NULL,
    longitude                   DECIMAL(10, 7)  NOT NULL,
    source                      VARCHAR(40)     NOT NULL,
    video_url                   VARCHAR(2048)   NULL,
    occurred_at                 TIMESTAMP       NULL,
    status                      VARCHAR(40)     NOT NULL DEFAULT 'open',
    geotab_exception_event_id   VARCHAR(64)     NULL,
    geotab_device_id            VARCHAR(64)     NULL,
    geotab_rule_id              VARCHAR(64)     NULL,
    altitude_meters             DECIMAL(8, 2)   NULL,
    created_at                  TIMESTAMP       NULL,
    updated_at                  TIMESTAMP       NULL
);
CREATE INDEX IF NOT EXISTS incidents_lat_lng_idx     ON incidents (latitude, longitude);
CREATE INDEX IF NOT EXISTS incidents_type_sev_idx    ON incidents (type, severity);
CREATE INDEX IF NOT EXISTS incidents_status_idx      ON incidents (status);
CREATE INDEX IF NOT EXISTS incidents_source_idx      ON incidents (source);
CREATE INDEX IF NOT EXISTS incidents_geotab_ev_idx   ON incidents (geotab_exception_event_id);
CREATE INDEX IF NOT EXISTS incidents_geotab_dev_idx  ON incidents (geotab_device_id);

CREATE TABLE IF NOT EXISTS incident_media (
    id                    BIGSERIAL     PRIMARY KEY,
    incident_id           BIGINT        NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    media_type            VARCHAR(20)   NOT NULL DEFAULT 'photo',
    url                   VARCHAR(2048) NULL,
    thumbnail_url         VARCHAR(2048) NULL,
    geotab_media_file_id  VARCHAR(64)   NULL,
    file_name             VARCHAR(255)  NULL,
    file_size             BIGINT        NULL,
    created_at            TIMESTAMP     NULL,
    updated_at            TIMESTAMP     NULL
);
CREATE INDEX IF NOT EXISTS incident_media_incident_idx ON incident_media (incident_id);
CREATE INDEX IF NOT EXISTS incident_media_geotab_idx   ON incident_media (geotab_media_file_id);

-- Registra las migraciones para que Laravel no intente correrlas de nuevo.
INSERT INTO migrations (migration, batch) VALUES
    ('0001_01_01_000000_create_users_table',                         1),
    ('0001_01_01_000001_create_cache_table',                         1),
    ('0001_01_01_000002_create_jobs_table',                          1),
    ('2026_06_09_012731_create_personal_access_tokens_table',        1),
    ('2026_06_09_012753_create_incidents_table',                     1),
    ('2026_06_14_000001_add_geotab_fields_to_incidents_table',       1),
    ('2026_06_14_000002_create_incident_media_table',                1)
ON CONFLICT DO NOTHING;
