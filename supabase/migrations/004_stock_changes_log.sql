-- ============================================================
-- Migration 004: Audit / change-log table
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_changes (
  id          BIGSERIAL   PRIMARY KEY,
  symbol      TEXT        NOT NULL,
  change_type TEXT        NOT NULL,  -- 'new_listing' | 'delisted' | 'name_change' | 'ticker_change' | 'metadata_update'
  old_value   JSONB,
  new_value   JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_changes_symbol      ON stock_changes (symbol);
CREATE INDEX IF NOT EXISTS idx_stock_changes_change_type ON stock_changes (change_type);
CREATE INDEX IF NOT EXISTS idx_stock_changes_detected_at ON stock_changes (detected_at DESC);

ALTER TABLE stock_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_changes_public_read"
  ON stock_changes FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY "stock_changes_service_all"
  ON stock_changes FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
