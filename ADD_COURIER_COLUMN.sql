-- Add courier column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier TEXT;

-- Index for filtering by courier
CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders (courier);
