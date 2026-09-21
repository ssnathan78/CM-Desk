-- Nifty Midcap Select (Kite/NSE symbol MIDCPNIFTY). Off by default, same as BankNifty/FinNifty.

ALTER TABLE chase_settings DROP CONSTRAINT IF EXISTS chase_settings_book_instrument_check;
ALTER TABLE chase_settings DROP CONSTRAINT IF EXISTS chase_settings_instrument_check;
ALTER TABLE chase_settings DROP CONSTRAINT IF EXISTS chase_settings_instrument_chk;

ALTER TABLE chase_settings
  ADD CONSTRAINT chase_settings_instrument_chk
  CHECK (instrument IN ('NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'));

INSERT INTO chase_settings (
  instrument, lots, ema_period, buffer_percent, entry_limit_offset, paused, enabled, open_classify
)
VALUES ('MIDCPNIFTY', 1, 40, 0.2, 5, true, false, 'pdf_0916')
ON CONFLICT (instrument) DO NOTHING;
