-- Create freebies table for tracking free items given away
CREATE TABLE IF NOT EXISTS freebies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Product Information
  item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  
  -- Cost Tracking
  cost_price DECIMAL(10,2) NOT NULL CHECK (cost_price >= 0),
  total_cogs DECIMAL(10,2) NOT NULL CHECK (total_cogs >= 0),
  
  -- Context
  given_with_sale_id TEXT, -- Optional: Reference to sale transaction
  reason TEXT, -- Why was it given free? (e.g., "With purchase", "Promotion", "Sample")
  
  -- Staff Information
  dispatched_by TEXT NOT NULL,
  dispatched_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Customer (optional)
  customer_name TEXT,
  
  -- Additional Notes
  notes TEXT
);

-- Create indexes for faster queries
CREATE INDEX idx_freebies_dispatched_date ON freebies(dispatched_date);
CREATE INDEX idx_freebies_item_id ON freebies(item_id);
CREATE INDEX idx_freebies_dispatched_by ON freebies(dispatched_by);
CREATE INDEX idx_freebies_created_at ON freebies(created_at);

-- Add RLS policies
ALTER TABLE freebies ENABLE ROW LEVEL SECURITY;

-- Allow admins and logistics-admin to view all freebies
CREATE POLICY "Allow authenticated users to view freebies"
  ON freebies FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins and logistics-admin to insert freebies
CREATE POLICY "Allow authenticated users to insert freebies"
  ON freebies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE freebies IS 'Tracks free items given away (promotions, samples, with purchase)';
