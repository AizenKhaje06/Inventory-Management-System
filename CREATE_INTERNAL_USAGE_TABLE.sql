-- Create internal_usage table
CREATE TABLE IF NOT EXISTS internal_usage (
  id          TEXT PRIMARY KEY,
  department  TEXT NOT NULL,
  usage_type  TEXT NOT NULL CHECK (usage_type IN ('demo', 'internal', 'transfer')),
  reason      TEXT NOT NULL,
  notes       TEXT,
  items       JSONB NOT NULL DEFAULT '[]',
  total_cost  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_qty   INTEGER NOT NULL DEFAULT 0,
  recorded_by TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_internal_usage_created_at ON internal_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_usage_department ON internal_usage (department);
CREATE INDEX IF NOT EXISTS idx_internal_usage_type ON internal_usage (usage_type);

-- items JSONB structure per record:
-- [{ "itemId": "ITEM-xxx", "itemName": "Berry Soap", "quantity": 2, "costPrice": 20.00, "totalCost": 40.00 }]
