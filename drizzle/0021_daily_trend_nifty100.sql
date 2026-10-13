-- One-time Nifty 100 seed. Later removals stay removed.

ALTER TABLE daily_trend_settings
  ADD COLUMN IF NOT EXISTS nifty100_seeded boolean NOT NULL DEFAULT false;
