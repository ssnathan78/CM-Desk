-- One Chase settings row per index. Lots, buffer, pause, and 09:16 classify are independent.

CREATE TABLE IF NOT EXISTS chase_settings_book (
  instrument text PRIMARY KEY
    CHECK (instrument IN ('NIFTY', 'BANKNIFTY', 'FINNIFTY')),
  lots integer NOT NULL DEFAULT 1,
  ema_period integer NOT NULL DEFAULT 40,
  buffer_percent numeric NOT NULL DEFAULT 0.2,
  entry_limit_offset numeric NOT NULL DEFAULT 5,
  paused boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT false,
  open_classify text NOT NULL DEFAULT 'pdf_0916'
    CHECK (open_classify IN ('pdf_0916', 'legacy_60m')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO chase_settings_book (
  instrument, lots, ema_period, buffer_percent, entry_limit_offset, paused, enabled, open_classify, updated_at
)
SELECT
  v.instrument,
  COALESCE(s.lots, 1),
  COALESCE(s.ema_period, 40),
  COALESCE(s.buffer_percent, 0.2),
  COALESCE(s.entry_limit_offset, 5),
  COALESCE(s.paused, false),
  CASE
    WHEN s.instruments IS NULL THEN (v.instrument = 'NIFTY')
    ELSE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(s.instruments) AS e(val)
      WHERE e.val = v.instrument
    )
  END,
  CASE
    WHEN s.open_classify IN ('pdf_0916', 'legacy_60m') THEN s.open_classify
    ELSE 'pdf_0916'
  END,
  COALESCE(s.updated_at, now())
FROM (VALUES ('NIFTY'), ('BANKNIFTY'), ('FINNIFTY')) AS v(instrument)
LEFT JOIN chase_settings s ON s.id = 1
ON CONFLICT (instrument) DO NOTHING;

INSERT INTO chase_settings_book (instrument, enabled, paused)
VALUES
  ('NIFTY', true, false),
  ('BANKNIFTY', false, true),
  ('FINNIFTY', false, true)
ON CONFLICT (instrument) DO NOTHING;

DROP TABLE chase_settings;
ALTER TABLE chase_settings_book RENAME TO chase_settings;
