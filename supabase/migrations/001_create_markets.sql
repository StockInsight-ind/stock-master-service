-- ============================================================
-- Migration 001: Create markets table
-- ============================================================

CREATE TABLE IF NOT EXISTS markets (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO markets (name) VALUES
  ('India'),
  ('USA'),
  ('Australia')
ON CONFLICT (name) DO NOTHING;
