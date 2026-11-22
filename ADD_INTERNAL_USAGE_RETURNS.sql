-- Add return tracking columns to internal_usage table
ALTER TABLE internal_usage
ADD COLUMN IF NOT EXISTS returned_items JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT 'pending' CHECK (return_status IN ('pending', 'partial', 'completed')),
ADD COLUMN IF NOT EXISTS last_return_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS return_history JSONB DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN internal_usage.returned_items IS 'Tracks returned quantity per item: {"itemId": {"returned": 2, "total": 3}}';
COMMENT ON COLUMN internal_usage.return_status IS 'Status: pending (none returned), partial (some returned), completed (all returned)';
COMMENT ON COLUMN internal_usage.last_return_date IS 'Timestamp of most recent return';
COMMENT ON COLUMN internal_usage.return_history IS 'Array of return events with dates and quantities';
