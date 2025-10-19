-- Global logs table for all extensions/modules
-- Safe defaults; adapt types to your conventions

CREATE TABLE IF NOT EXISTS quartz_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  level varchar(16) NOT NULL DEFAULT 'info',        -- trace|debug|info|warn|error
  source varchar(64) NOT NULL,                      -- e.g. 'automations', 'formulas', 'realtime-recalc'
  module varchar(64),                               -- sub-module name if any
  message text,                                     -- human message

  -- Correlation & targeting
  correlation_id uuid,                              -- to group related events (same request/flow)
  user_id uuid,                                     -- accountability.user when available
  collection varchar(128),                          -- target collection (if applicable)
  item_id varchar(64),                              -- target item id as string (uuid/int/text)
  rule_id varchar(64),                              -- automation/formula rule id (if applicable)
  action_type varchar(64),                          -- set_field|create_item|update_item|update_many|...

  -- Diagnostics & metrics
  duration_ms integer,                              -- time spent for this step if measured
  error_code varchar(64),
  error_stack text,

  -- Flexible payloads
  ctx jsonb,                                        -- structured context (keys: changed, payload sizes, etc.)
  extra jsonb                                       -- free-form extra data
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS quartz_logs_ts_idx ON quartz_logs (ts DESC);
CREATE INDEX IF NOT EXISTS quartz_logs_level_idx ON quartz_logs (level);
CREATE INDEX IF NOT EXISTS quartz_logs_source_idx ON quartz_logs (source);
CREATE INDEX IF NOT EXISTS quartz_logs_collection_item_idx ON quartz_logs (collection, item_id);
CREATE INDEX IF NOT EXISTS quartz_logs_rule_idx ON quartz_logs (rule_id);
CREATE INDEX IF NOT EXISTS quartz_logs_corr_idx ON quartz_logs (correlation_id);
CREATE INDEX IF NOT EXISTS quartz_logs_ctx_gin ON quartz_logs USING gin (ctx);

-- Optional: retention policy handled outside (cron) or via partitioning
-- Suggestion: monthly partitions for high-volume installations
