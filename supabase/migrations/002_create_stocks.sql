-- ============================================================
-- Migration 002: Create stocks table
-- ============================================================

CREATE TABLE IF NOT EXISTS stocks (
  id           BIGSERIAL PRIMARY KEY,
  symbol       TEXT        NOT NULL UNIQUE,
  company_name TEXT        NOT NULL DEFAULT '',
  market       TEXT        NOT NULL,           -- 'India' | 'USA' | 'Australia'
  exchange     TEXT        NOT NULL DEFAULT '',
  currency     TEXT        NOT NULL DEFAULT '',
  country      TEXT        NOT NULL DEFAULT '',
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  delisted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_stocks_symbol       ON stocks (symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_company_name ON stocks (company_name);
CREATE INDEX IF NOT EXISTS idx_stocks_market        ON stocks (market);
CREATE INDEX IF NOT EXISTS idx_stocks_is_active     ON stocks (is_active);

-- Full-text search index (symbol + company_name)
CREATE INDEX IF NOT EXISTS idx_stocks_fts ON stocks
  USING GIN (
    to_tsvector('english', symbol || ' ' || company_name)
  );

-- Partial index: only active stocks (speeds up search queries)
CREATE INDEX IF NOT EXISTS idx_stocks_active_market ON stocks (market, symbol)
  WHERE is_active = TRUE;
