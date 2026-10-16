CREATE TABLE IF NOT EXISTS "strategy_templates" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "strategy" "job_execution_strategy" NOT NULL,
  "instrument" text NOT NULL,
  "expiry_type" text NOT NULL,
  "product_type" text NOT NULL,
  "exit_strategy" text,
  "combined_exit_strategy" text,
  "run_at" timestamp with time zone,
  "square_off_time" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "expire_if_unsuccessful_in_mins" integer,
  "lots" integer NOT NULL,
  "slm_percent" smallint,
  "sl_order_type" text,
  "sl_limit_price_percent" smallint,
  "max_profit_points" smallint,
  "is_max_profit_enabled" boolean DEFAULT false,
  "max_loss_points" smallint,
  "is_max_loss_enabled" boolean DEFAULT false,
  "threshold_skew_percent" smallint,
  "max_skew_percent" smallint,
  "take_trade_irrespective_skew" boolean DEFAULT false,
  "volatility_type" text,
  "trail_every_percentage_change_value" smallint,
  "trailing_sl_percent" smallint,
  "trailing_max_profit_points" smallint,
  "trailing_max_loss_points" smallint,
  "trailing_profit_percent" numeric,
  "is_auto_square_off_enabled" boolean DEFAULT false,
  "auto_square_off_time" timestamp with time zone,
  "extras" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "strategy_schedules" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" text NOT NULL REFERENCES "strategy_templates"("id"),
  "day_of_week" "day_of_week_enum" NOT NULL,
  "run_at" timestamp with time zone,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "strategy_schedules_template_day_uidx"
  ON "strategy_schedules" ("template_id", "day_of_week");

ALTER TABLE "job_executions" ADD COLUMN IF NOT EXISTS "template_id" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_executions_template_id_strategy_templates_id_fk'
  ) THEN
    ALTER TABLE "job_executions"
      ADD CONSTRAINT "job_executions_template_id_strategy_templates_id_fk"
      FOREIGN KEY ("template_id") REFERENCES "strategy_templates"("id") ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO "strategy_templates" (
  "id", "name", "strategy", "instrument", "expiry_type", "product_type",
  "exit_strategy", "combined_exit_strategy", "run_at", "square_off_time", "expires_at",
  "expire_if_unsuccessful_in_mins", "lots", "slm_percent", "sl_order_type",
  "sl_limit_price_percent", "max_profit_points", "is_max_profit_enabled",
  "max_loss_points", "is_max_loss_enabled", "threshold_skew_percent", "max_skew_percent",
  "take_trade_irrespective_skew", "volatility_type", "trail_every_percentage_change_value",
  "trailing_sl_percent", "trailing_max_profit_points", "trailing_max_loss_points",
  "trailing_profit_percent", "is_auto_square_off_enabled", "auto_square_off_time",
  "extras", "created_at", "updated_at"
)
SELECT
  p.id,
  CASE
    WHEN counts.cnt > 1 THEN p.name || ' ' || COALESCE(p.day_of_week::text, '') || ' ' || p.instrument
    ELSE p.name
  END,
  p.strategy, p.instrument, p.expiry_type, p.product_type,
  p.exit_strategy, p.combined_exit_strategy, p.run_at, p.square_off_time, p.expires_at,
  p.expire_if_unsuccessful_in_mins, p.lots, p.slm_percent, p.sl_order_type,
  p.sl_limit_price_percent, p.max_profit_points, p.is_max_profit_enabled,
  p.max_loss_points, p.is_max_loss_enabled, p.threshold_skew_percent, p.max_skew_percent,
  p.take_trade_irrespective_skew, p.volatility_type, p.trail_every_percentage_change_value,
  p.trailing_sl_percent, p.trailing_max_profit_points, p.trailing_max_loss_points,
  p.trailing_profit_percent, p.is_auto_square_off_enabled, p.auto_square_off_time,
  p.extras, p.created_at, p.updated_at
FROM "trade_plans" p
JOIN (
  SELECT name, count(*) AS cnt FROM "trade_plans" GROUP BY name
) counts ON counts.name = p.name
WHERE NOT EXISTS (SELECT 1 FROM "strategy_templates" t WHERE t.id = p.id);

INSERT INTO "strategy_schedules" ("template_id", "day_of_week", "run_at", "enabled")
SELECT p.id, p.day_of_week, p.run_at, true
FROM "trade_plans" p
WHERE p.day_of_week IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "strategy_schedules" s
    WHERE s.template_id = p.id AND s.day_of_week = p.day_of_week
  );

UPDATE "job_executions" j
SET "template_id" = j.plan_ref
WHERE j.template_id IS NULL
  AND j.plan_ref IS NOT NULL
  AND EXISTS (SELECT 1 FROM "strategy_templates" t WHERE t.id = j.plan_ref);

CREATE UNIQUE INDEX IF NOT EXISTS "strategy_templates_name_uidx" ON "strategy_templates" ("name");
