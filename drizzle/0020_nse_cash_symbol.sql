-- NSE cash symbols include '&' (M&M). A leading digit is not a symbol.
-- Drop names already saved that are not that shape (for example 123 or ABC with a space).

DELETE FROM daily_trend_books
WHERE tradingsymbol !~ '^[A-Z][A-Z0-9&-]{0,19}$';

ALTER TABLE daily_trend_books DROP CONSTRAINT IF EXISTS daily_trend_books_symbol_chk;

ALTER TABLE daily_trend_books
  ADD CONSTRAINT daily_trend_books_symbol_chk
  CHECK (tradingsymbol ~ '^[A-Z][A-Z0-9&-]{0,19}$');
