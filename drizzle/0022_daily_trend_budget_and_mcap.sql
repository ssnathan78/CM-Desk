-- Rupee budget for daily trend, and a market-cap table that the hourly job refreshes.

ALTER TABLE daily_trend_books
  ADD COLUMN IF NOT EXISTS budget_inr numeric NOT NULL DEFAULT 0;

UPDATE daily_trend_books
SET buffer_percent = 1,
    exit_buffer_percent = 1
WHERE enabled = false
  AND paused = false
  AND status = 'FLAT'
  AND quantity = 1
  AND buffer_percent = 0.2
  AND exit_buffer_percent = 0.2;

CREATE TABLE IF NOT EXISTS equity_market_caps (
  tradingsymbol text PRIMARY KEY,
  company_name text,
  industry text,
  market_cap_cr numeric,
  as_of date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
