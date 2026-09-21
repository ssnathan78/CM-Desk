-- Weekday templates are unique per strategy AND index (Nifty straddle and BankNifty straddle can both exist on Monday).

DROP INDEX IF EXISTS trade_plans_day_strategy_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS trade_plans_day_strategy_instrument_uidx
  ON trade_plans (day_of_week, strategy, instrument);
