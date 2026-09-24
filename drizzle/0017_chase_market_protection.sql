-- Per-index cap on how far a Chase market order's protective limit sits from the last price.
-- 2% sold Nifty just outside the exchange limit-price band. 1.5% stays inside that band.
ALTER TABLE chase_settings
  ADD COLUMN IF NOT EXISTS market_protection_percent numeric NOT NULL DEFAULT 1.5;
