-- Cash momentum and daily long-only trend. Both default to calculate-only.
-- History pulls and orders stay off until the operator turns them on.

CREATE TABLE IF NOT EXISTS momentum_settings (
  id integer PRIMARY KEY,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_data_pull_on date,
  last_rebalance_on date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO momentum_settings (id, config)
VALUES (1, '{"active":false,"dataRefresh":false,"execution":"report"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS momentum_universe (
  tradingsymbol text PRIMARY KEY,
  company_name text,
  series text NOT NULL DEFAULT 'EQ'
);

CREATE TABLE IF NOT EXISTS momentum_weight_locks (
  tradingsymbol text PRIMARY KEY,
  mode text NOT NULL,
  weight_pct numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT momentum_weight_locks_mode_chk CHECK (mode IN ('HOLD_WEIGHT', 'EXCLUDE'))
);

CREATE TABLE IF NOT EXISTS equity_daily_bars (
  tradingsymbol text NOT NULL,
  session_date date NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (tradingsymbol, session_date)
);

CREATE INDEX IF NOT EXISTS idx_equity_daily_bars_symbol ON equity_daily_bars (tradingsymbol);

CREATE TABLE IF NOT EXISTS daily_trend_settings (
  id integer PRIMARY KEY,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_data_pull_on date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO daily_trend_settings (id, config)
VALUES (1, '{"active":false,"dataRefresh":false,"execution":"report"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS daily_trend_books (
  tradingsymbol text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  paused boolean NOT NULL DEFAULT false,
  ema_period integer NOT NULL DEFAULT 40,
  buffer_percent numeric NOT NULL DEFAULT '0.2',
  exit_buffer_percent numeric NOT NULL DEFAULT '0.2',
  quantity integer NOT NULL DEFAULT 1,
  entry_style text NOT NULL DEFAULT 'CLOSE_CROSS',
  status text NOT NULL DEFAULT 'FLAT',
  stop_price numeric,
  entry_price numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_trend_books_symbol_chk CHECK (tradingsymbol ~ '^[A-Z0-9][A-Z0-9-]{0,29}$'),
  CONSTRAINT daily_trend_books_entry_chk CHECK (entry_style IN ('CLOSE_CROSS', 'BREAK_HIGH')),
  CONSTRAINT daily_trend_books_status_chk CHECK (status IN ('FLAT', 'PENDING_LONG', 'LONG')),
  CONSTRAINT daily_trend_books_qty_chk CHECK (quantity >= 0)
);
