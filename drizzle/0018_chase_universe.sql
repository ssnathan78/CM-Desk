-- Chase books are no longer limited to the four index names.
-- The universe row is the underlying (Kite NFO name). The futures contract is resolved at runtime.

CREATE TABLE IF NOT EXISTS chase_universe (
  instrument text PRIMARY KEY,
  exchange text NOT NULL DEFAULT 'NFO',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chase_universe_instrument_chk CHECK (instrument ~ '^[A-Z][A-Z0-9]{0,19}$'),
  CONSTRAINT chase_universe_exchange_chk CHECK (exchange = 'NFO')
);

INSERT INTO chase_universe (instrument)
SELECT instrument FROM chase_settings
ON CONFLICT (instrument) DO NOTHING;

INSERT INTO chase_universe (instrument) VALUES
  ('NIFTY'),
  ('BANKNIFTY'),
  ('FINNIFTY'),
  ('MIDCPNIFTY')
ON CONFLICT (instrument) DO NOTHING;

ALTER TABLE chase_settings DROP CONSTRAINT IF EXISTS chase_settings_instrument_chk;

ALTER TABLE chase_settings
  ADD CONSTRAINT chase_settings_instrument_chk
  CHECK (instrument ~ '^[A-Z][A-Z0-9]{0,19}$');

ALTER TABLE chase_settings DROP CONSTRAINT IF EXISTS chase_settings_universe_fk;

ALTER TABLE chase_settings
  ADD CONSTRAINT chase_settings_universe_fk
  FOREIGN KEY (instrument) REFERENCES chase_universe (instrument);
