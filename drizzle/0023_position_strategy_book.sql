-- Two strategies can hold the same contract. The book key includes strategy.

DROP INDEX IF EXISTS positions_book_uidx;

CREATE UNIQUE INDEX positions_book_uidx
  ON positions (
    account_id,
    exchange,
    tradingsymbol,
    product,
    COALESCE(job_id, ''),
    COALESCE(strategy, '')
  );
