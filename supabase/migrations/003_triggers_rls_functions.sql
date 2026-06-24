-- ============================================================
-- Migration 003: Triggers, RLS, helper functions
-- ============================================================

-- ── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stocks_updated_at ON stocks;
CREATE TRIGGER trg_stocks_updated_at
  BEFORE UPDATE ON stocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Enable RLS ──────────────────────────────────────────────
ALTER TABLE stocks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;

-- Public read-only access (anon + authenticated)
CREATE POLICY "stocks_public_read"
  ON stocks FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY "markets_public_read"
  ON markets FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Service role has full access (used by Edge Functions + GitHub Actions)
CREATE POLICY "stocks_service_all"
  ON stocks FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "markets_service_all"
  ON markets FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ── Search helper (used by Edge Function) ──────────────────
CREATE OR REPLACE FUNCTION search_stocks(
  query_text TEXT,
  market_filter TEXT DEFAULT NULL,
  result_limit  INT  DEFAULT 20
)
RETURNS TABLE (
  symbol       TEXT,
  company_name TEXT,
  market       TEXT,
  exchange     TEXT,
  currency     TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.symbol,
    s.company_name,
    s.market,
    s.exchange,
    s.currency
  FROM stocks s
  WHERE
    s.is_active = TRUE
    AND (market_filter IS NULL OR s.market = market_filter)
    AND (
      s.symbol       ILIKE query_text || '%'
      OR s.company_name ILIKE '%' || query_text || '%'
    )
  ORDER BY
    CASE WHEN s.symbol ILIKE query_text || '%' THEN 0 ELSE 1 END,
    s.symbol
  LIMIT result_limit;
$$;
