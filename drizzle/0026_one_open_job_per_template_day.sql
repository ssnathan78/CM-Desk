-- One open run per template per IST day. Rejected and failed rows stay, so the operator can send again.
CREATE UNIQUE INDEX IF NOT EXISTS job_executions_one_open_template_ist_day
ON job_executions (
  template_id,
  ((created_at AT TIME ZONE 'Asia/Kolkata')::date)
)
WHERE status IN ('PENDING', 'QUEUE', 'EXECUTING')
  AND template_id IS NOT NULL;
