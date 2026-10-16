-- Stored momentum rank for page loads, and index membership diffs.

ALTER TABLE momentum_settings
  ADD COLUMN IF NOT EXISTS cached_report jsonb,
  ADD COLUMN IF NOT EXISTS cached_as_of date,
  ADD COLUMN IF NOT EXISTS cached_at timestamptz,
  ADD COLUMN IF NOT EXISTS cached_fingerprint text;

CREATE TABLE IF NOT EXISTS index_membership (
  index_code text NOT NULL,
  tradingsymbol text NOT NULL,
  company_name text,
  series text NOT NULL DEFAULT 'EQ',
  as_of date NOT NULL,
  PRIMARY KEY (index_code, tradingsymbol)
);

CREATE TABLE IF NOT EXISTS index_membership_changes (
  id serial PRIMARY KEY,
  index_code text NOT NULL,
  tradingsymbol text NOT NULL,
  company_name text,
  action text NOT NULL,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING',
  detected_on date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT index_membership_changes_action_chk CHECK (action IN ('ADD', 'REMOVE')),
  CONSTRAINT index_membership_changes_status_chk CHECK (status IN ('PENDING', 'ACCEPTED', 'DISMISSED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS index_membership_changes_open
  ON index_membership_changes (index_code, tradingsymbol, action)
  WHERE status = 'PENDING';
