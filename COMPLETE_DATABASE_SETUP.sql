-- ============================================
-- COMPLETE DATABASE SETUP FOR INVENTORY MANAGEMENT SYSTEM
-- Single Copy-Paste Script for Supabase SQL Editor
-- ============================================
-- This script creates all tables, indexes, policies, and triggers
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MAIN TABLES
-- ============================================

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage Rooms Table (renamed from storage_rooms to store_rooms)
CREATE TABLE IF NOT EXISTS store_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users Table (Simplified to 2 roles: admin and logistics-admin)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'logistics-admin')),
  email TEXT,
  profile_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_token TEXT UNIQUE,
  session_expires_at TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  cogs DECIMAL(10,2) NOT NULL CHECK (cogs >= 0),
  selling_price DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  store_room_id UUID REFERENCES store_rooms(id) ON DELETE SET NULL,
  low_stock_threshold INT DEFAULT 10,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_inventory_item UNIQUE NULLS NOT DISTINCT (name, store_room_id)
);

-- Bundles Table
CREATE TABLE IF NOT EXISTS bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  selling_price DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0),
  quantity INT NOT NULL DEFAULT 0,
  store_room_id UUID REFERENCES store_rooms(id) ON DELETE SET NULL,
  low_stock_threshold INT DEFAULT 10,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bundle Items (many-to-many relationship)
CREATE TABLE IF NOT EXISTS bundle_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bundle_id, item_id)
);

-- Business Contacts (formerly customers)
CREATE TABLE IF NOT EXISTS business_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  company TEXT,
  contact_type TEXT CHECK (contact_type IN ('customer', 'supplier', 'both')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  cost_price DECIMAL(10,2) NOT NULL CHECK (cost_price >= 0),
  selling_price DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0),
  total_cost DECIMAL(10,2) NOT NULL CHECK (total_cost >= 0),
  total_revenue DECIMAL(10,2) NOT NULL CHECK (total_revenue >= 0),
  profit DECIMAL(10,2) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('sale', 'return', 'adjustment')),
  staff_name TEXT NOT NULL,
  notes TEXT,
  waybill_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT
);

-- Logs Table
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('add', 'update', 'delete', 'sale', 'restock', 'adjustment')),
  quantity INT,
  staff_name TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  details TEXT
);

-- Restocks Table
CREATE TABLE IF NOT EXISTS restocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  cost_price DECIMAL(10,2) NOT NULL CHECK (cost_price >= 0),
  total_cost DECIMAL(10,2) NOT NULL CHECK (total_cost >= 0),
  supplier TEXT,
  staff_name TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  qty INT NOT NULL CHECK (qty > 0),
  cogs DECIMAL(10,2) NOT NULL CHECK (cogs >= 0),
  total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  product TEXT NOT NULL,
  dispatched_by TEXT NOT NULL,
  waybill_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial', 'cancelled')),
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  channel TEXT CHECK (channel IN ('WhatsApp', 'Instagram', 'Facebook', 'Walk-in', 'Phone', 'Other')),
  notes TEXT,
  is_cancelled BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  cancellation_reason TEXT,
  restored_at TIMESTAMPTZ,
  restored_by TEXT,
  confirmation_status TEXT DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'unconfirmed')),
  good_items INT DEFAULT 0,
  bad_items INT DEFAULT 0,
  reason TEXT,
  bad_items_breakdown JSONB DEFAULT '[]'::jsonb
);

-- Freebies Table
CREATE TABLE IF NOT EXISTS freebies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  cost_price DECIMAL(10,2) NOT NULL CHECK (cost_price >= 0),
  total_cogs DECIMAL(10,2) NOT NULL CHECK (total_cogs >= 0),
  given_with_sale_id TEXT,
  reason TEXT,
  dispatched_by TEXT NOT NULL,
  dispatched_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT,
  notes TEXT
);

-- Inventory Alerts Table
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'expired')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- Dispatch Tracking Table
CREATE TABLE IF NOT EXISTS dispatch_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  waybill_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED')),
  carrier TEXT,
  tracking_notes TEXT,
  dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  updated_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Packing Queue Table (formerly transaction_history)
CREATE TABLE IF NOT EXISTS packing_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  packing_status TEXT DEFAULT 'pending' CHECK (packing_status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  packed_at TIMESTAMP WITH TIME ZONE,
  packed_by TEXT,
  notes TEXT
);

-- Email Reports Table
CREATE TABLE IF NOT EXISTS email_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type TEXT NOT NULL CHECK (report_type IN ('daily_sales', 'weekly_summary', 'monthly_summary', 'low_stock', 'custom')),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending'))
);

-- Email Schedules Table
CREATE TABLE IF NOT EXISTS email_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily_sales', 'weekly_summary', 'monthly_summary', 'low_stock', 'custom')),
  recipient_emails TEXT[] NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
  time_of_day TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  date_range TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- VIEWS
-- ============================================

-- Products Unified View (combines inventory and bundles)
CREATE OR REPLACE VIEW products_unified AS
SELECT 
  i.id,
  i.name,
  i.sku,
  'inventory' AS type,
  i.quantity,
  i.cogs,
  i.selling_price,
  i.category_id,
  c.name AS category_name,
  i.store_room_id,
  sr.name AS store_room_name,
  i.low_stock_threshold,
  i.image_url,
  NULL::jsonb AS bad_items_breakdown,
  i.created_at,
  i.updated_at
FROM inventory i
LEFT JOIN categories c ON i.category_id = c.id
LEFT JOIN store_rooms sr ON i.store_room_id = sr.id

UNION ALL

SELECT 
  b.id,
  b.name,
  NULL AS sku,
  'bundle' AS type,
  b.quantity,
  COALESCE((
    SELECT SUM(bi.quantity * i.cogs)
    FROM bundle_items bi
    JOIN inventory i ON bi.item_id = i.id
    WHERE bi.bundle_id = b.id
  ), 0) AS cogs,
  b.selling_price,
  NULL AS category_id,
  NULL AS category_name,
  b.store_room_id,
  sr.name AS store_room_name,
  b.low_stock_threshold,
  b.image_url,
  NULL::jsonb AS bad_items_breakdown,
  b.created_at,
  b.updated_at
FROM bundles b
LEFT JOIN store_rooms sr ON b.store_room_id = sr.id;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(name);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_store_room ON inventory(store_room_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);

-- Bundles indexes
CREATE INDEX IF NOT EXISTS idx_bundles_name ON bundles(name);
CREATE INDEX IF NOT EXISTS idx_bundles_store_room ON bundles(store_room_id);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_staff ON transactions(staff_name);
CREATE INDEX IF NOT EXISTS idx_transactions_waybill ON transactions(waybill_number);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_dispatched_by ON orders(dispatched_by);
CREATE INDEX IF NOT EXISTS idx_orders_waybill ON orders(waybill_number);
CREATE INDEX IF NOT EXISTS idx_orders_is_cancelled ON orders(is_cancelled);
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON orders(cancelled_at);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_confirmation_status ON orders(confirmation_status);

-- Freebies indexes
CREATE INDEX IF NOT EXISTS idx_freebies_dispatched_date ON freebies(dispatched_date);
CREATE INDEX IF NOT EXISTS idx_freebies_item_id ON freebies(item_id);
CREATE INDEX IF NOT EXISTS idx_freebies_dispatched_by ON freebies(dispatched_by);
CREATE INDEX IF NOT EXISTS idx_freebies_created_at ON freebies(created_at);

-- Logs indexes
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_operation ON logs(operation);
CREATE INDEX IF NOT EXISTS idx_logs_item_id ON logs(item_id);

-- Restocks indexes
CREATE INDEX IF NOT EXISTS idx_restocks_timestamp ON restocks(timestamp);
CREATE INDEX IF NOT EXISTS idx_restocks_item_id ON restocks(item_id);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ============================================
-- TRIGGERS AND FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bundles_updated_at ON bundles;
CREATE TRIGGER update_bundles_updated_at
  BEFORE UPDATE ON bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_business_contacts_updated_at ON business_contacts;
CREATE TRIGGER update_business_contacts_updated_at
  BEFORE UPDATE ON business_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-calculate bundle quantity based on component inventory
CREATE OR REPLACE FUNCTION calculate_bundle_quantity()
RETURNS TRIGGER AS $$
DECLARE
  min_possible_bundles INT;
BEGIN
  -- Calculate minimum possible bundles based on component inventory
  SELECT MIN(FLOOR(i.quantity / bi.quantity))
  INTO min_possible_bundles
  FROM bundle_items bi
  JOIN inventory i ON bi.item_id = i.id
  WHERE bi.bundle_id = NEW.id;

  -- Update bundle quantity
  UPDATE bundles
  SET quantity = COALESCE(min_possible_bundles, 0)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate bundle quantities when bundle_items change
DROP TRIGGER IF EXISTS recalculate_bundle_quantity_on_bundle_items ON bundle_items;
CREATE TRIGGER recalculate_bundle_quantity_on_bundle_items
  AFTER INSERT OR UPDATE OR DELETE ON bundle_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_bundle_quantity();

-- Function to update all bundles when inventory quantity changes
CREATE OR REPLACE FUNCTION update_all_bundles_on_inventory_change()
RETURNS TRIGGER AS $$
DECLARE
  affected_bundle_id UUID;
BEGIN
  -- Find all bundles that contain this inventory item
  FOR affected_bundle_id IN
    SELECT DISTINCT bundle_id
    FROM bundle_items
    WHERE item_id = COALESCE(NEW.id, OLD.id)
  LOOP
    -- Recalculate quantity for each affected bundle
    UPDATE bundles
    SET quantity = (
      SELECT MIN(FLOOR(i.quantity / bi.quantity))
      FROM bundle_items bi
      JOIN inventory i ON bi.item_id = i.id
      WHERE bi.bundle_id = affected_bundle_id
    )
    WHERE id = affected_bundle_id;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update bundles when inventory changes
DROP TRIGGER IF EXISTS update_bundles_on_inventory_change ON inventory;
CREATE TRIGGER update_bundles_on_inventory_change
  AFTER UPDATE OF quantity OR DELETE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_all_bundles_on_inventory_change();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE restocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE freebies ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Service role has full access to everything
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "%s_service_role_all" ON %I;
      CREATE POLICY "%s_service_role_all"
      ON %I
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    ', table_name, table_name, table_name, table_name);
  END LOOP;
END $$;

-- Authenticated users can read most tables
CREATE POLICY "inventory_select_policy" ON inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "bundles_select_policy" ON bundles FOR SELECT TO authenticated USING (true);
CREATE POLICY "bundle_items_select_policy" ON bundle_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "transactions_select_policy" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs_select_policy" ON logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "restocks_select_policy" ON restocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "store_rooms_select_policy" ON store_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_select_policy" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "business_contacts_select_policy" ON business_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_select_policy" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "freebies_select_policy" ON freebies FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_alerts_select_policy" ON inventory_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "dispatch_tracking_select_policy" ON dispatch_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "packing_queue_select_policy" ON packing_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "notifications_select_policy" ON notifications FOR SELECT TO authenticated USING (true);

-- Users table is restricted (only service role can access)
CREATE POLICY "users_no_public_access" ON users FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Authenticated users can insert into certain tables
CREATE POLICY "freebies_insert_policy" ON freebies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_insert_policy" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('product-images', 'product-images', true),
  ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Storage policies for profile images
CREATE POLICY "Public read access for profile images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

CREATE POLICY "Authenticated users can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-images');

CREATE POLICY "Authenticated users can update profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-images');

CREATE POLICY "Authenticated users can delete profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-images');

-- ============================================
-- INITIAL DATA (OPTIONAL)
-- ============================================

-- Insert default categories (optional)
INSERT INTO categories (name, description) VALUES
  ('Electronics', 'Electronic devices and accessories'),
  ('Clothing', 'Apparel and fashion items'),
  ('Food', 'Food and beverage products'),
  ('Office', 'Office supplies and equipment'),
  ('Other', 'Miscellaneous items')
ON CONFLICT (name) DO NOTHING;

-- Insert default store rooms (optional)
INSERT INTO store_rooms (name, location) VALUES
  ('Main Warehouse', 'Building A'),
  ('Retail Store', 'Building B'),
  ('Distribution Center', 'Building C')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after migration to verify setup:

-- Check all tables
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check policies
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Check triggers
-- SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;

-- ============================================
-- SCRIPT COMPLETE
-- ============================================
-- Your database is now fully set up and ready to use!
-- ============================================
