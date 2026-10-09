/**
 * Database tables. Every statement is safe to run more than once
 * (IF NOT EXISTS), so /api/setup can be called again at any time.
 */
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    telegram_id  BIGINT PRIMARY KEY,
    username     TEXT,
    first_name   TEXT,
    last_name    TEXT,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked')),
    is_admin     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at  TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS links (
    id          BIGSERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    owner_id    BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    target_url  TEXT NOT NULL,
    image_url   TEXT,
    caption     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS links_owner_idx ON links (owner_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS clicks (
    id          BIGSERIAL PRIMARY KEY,
    link_id     BIGINT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    country     TEXT,
    device      TEXT,
    os          TEXT,
    source      TEXT,
    visitor     TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS clicks_link_time_idx ON clicks (link_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS clicks_time_idx ON clicks (created_at)`,
];
