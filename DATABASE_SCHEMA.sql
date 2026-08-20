-- ============================================
-- COMPLETE SQL SCHEMA FOR INVENTORY MANAGEMENT SYSTEM
-- Database: PostgreSQL (Supabase)
-- Generated: August 20, 2026
-- ============================================

-- ============================================
-- 1. USERS TABLE (Authentication & Authorization)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Hashed password (bcrypt)
    role TEXT NOT NULL CHECK (role IN ('admin', 'operations', 'packer', 'logistics-admin', 'tracker')),
    display_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    assigned_channel TEXT, -- Sales channel assignment for operations/dept-manager roles
    profile_image TEXT, -- URL to profile image in Supabase Storage
    
    -- Session Management
    active_session_id TEXT,
    session_created_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ,
    
    -- Two-Factor Authentication
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret TEXT,
    two_factor_backup_codes TEXT[], -- Array of backup codes
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_assigned_channel ON users(assigned_channel);
CREATE INDEX IF NOT EXISTS idx_users_active_session ON users(active_session_id);

-- ============================================
-- 2. CATEGORIES TABLE (Product Categories)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for categories table
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- ============================================
-- 3. STORES TABLE (Physical/Online Stores)
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    sales_channel TEXT NOT NULL, -- 'Shopee', 'Lazada', 'Facebook', 'TikTok', 'Physical Store', etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for stores table
CREATE INDEX IF NOT EXISTS idx_stores_sales_channel ON stores(sales_channel);
CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(store_name);

-- ============================================
-- 4. INVENTORY TABLE (Product Inventory)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    store TEXT NOT NULL, -- Storage location or sales channel
    sales_channel TEXT, -- Sales channel (Shopee, Lazada, etc.)
    quantity INTEGER NOT NULL DEFAULT 0,
    cost_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    reorder_level INTEGER NOT NULL DEFAULT 10,
    total_cogs DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Total Cost of Goods Sold
    sku TEXT,
    
    -- Discount fields
    discount DECIMAL(5, 2) DEFAULT 0, -- Percentage discount
    discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
    discount_end_date TIMESTAMPTZ,
    min_price DECIMAL(10, 2), -- Minimum selling price (for profit protection)
    
    -- Product metadata
    images TEXT[], -- Array of image URLs
    image_url TEXT, -- Primary product image URL from Supabase Storage
    product_type TEXT DEFAULT 'regular' CHECK (product_type IN ('regular', 'bundle')),
    
    -- Bad Item Tracking
    item_status TEXT DEFAULT 'good' CHECK (item_status IN ('good', 'bad')),
    bad_item_reason TEXT,
    bad_item_quantity INTEGER DEFAULT 0,
    bad_items_breakdown JSONB, -- JSON object: {"damage": 50, "defect": 30}
    
    -- Timestamps
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign Keys
    FOREIGN KEY (category) REFERENCES categories(name) ON DELETE RESTRICT,
    FOREIGN KEY (store) REFERENCES stores(store_name) ON DELETE RESTRICT
);

-- Indexes for inventory table
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(name);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory(store);
CREATE INDEX IF NOT EXISTS idx_inventory_sales_channel ON inventory(sales_channel);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_product_type ON inventory(product_type);
CREATE INDEX IF NOT EXISTS idx_inventory_item_status ON inventory(item_status);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(quantity, reorder_level) WHERE quantity <= reorder_level;

-- ============================================
-- 5. TRANSACTIONS TABLE (Sales & Inventory Movements)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    total_revenue DECIMAL(10, 2) NOT NULL,
    profit DECIMAL(10, 2) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('sale', 'restock')),
    transaction_type TEXT CHECK (transaction_type IN ('sale', 'demo', 'internal', 'transfer')),
    department TEXT,
    
    -- Customer Information
    customer_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    customer_address TEXT,
    
    -- Discount & Staff
    discount DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    staff_name TEXT,
    notes TEXT,
    
    -- Transaction Status Tracking
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'returned', 'pending')),
    cancellation_reason TEXT,
    cancelled_by TEXT,
    cancelled_at TIMESTAMPTZ,
    
    -- Foreign Keys
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE
);

-- Indexes for transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);

-- ============================================
-- 6. ORDERS TABLE (E-commerce Orders & Packing Queue)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL,
    sales_channel TEXT NOT NULL, -- 'Shopee', 'Lazada', 'Facebook', 'TikTok', etc.
    store TEXT NOT NULL, -- Store/seller name
    courier TEXT, -- Shipping courier (J&T, LBC, etc.)
    waybill TEXT, -- Tracking/waybill number
    qty INTEGER NOT NULL,
    cogs DECIMAL(10, 2) NOT NULL, -- Cost of Goods Sold (actual cost)
    total DECIMAL(10, 2) NOT NULL, -- Total order amount (revenue)
    product TEXT NOT NULL, -- Product name with variants
    product_name TEXT, -- Clean product name (for display)
    order_number TEXT, -- Order reference number
    
    -- Order Status & Workflow
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Packed')), -- Pending = Packing Queue, Packed = Track Orders
    parcel_status TEXT NOT NULL CHECK (parcel_status IN ('PENDING', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED')),
    
    -- Cancellation Tracking
    is_cancelled BOOLEAN DEFAULT false, -- For Packing Queue cancellations
    cancellation_reason TEXT,
    reason TEXT, -- Alternative field for cancellation/return reason
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT,
    
    -- Staff Assignment
    dispatched_by TEXT, -- Staff who dispatched the order
    packed_by TEXT, -- Staff who packed the order
    packed_at TIMESTAMPTZ, -- When the order was packed (revenue recognition timestamp)
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- Soft delete
);

-- Indexes for orders table
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sales_channel ON orders(sales_channel);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_parcel_status ON orders(parcel_status);
CREATE INDEX IF NOT EXISTS idx_orders_waybill ON orders(waybill);
CREATE INDEX IF NOT EXISTS idx_orders_packed_at ON orders(packed_at);
CREATE INDEX IF NOT EXISTS idx_orders_is_cancelled ON orders(is_cancelled);
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_orders_active ON orders(status, parcel_status) WHERE deleted_at IS NULL;

-- ============================================
-- 7. CUSTOMERS TABLE (Customer Management)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    loyalty_points INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    last_purchase TIMESTAMPTZ,
    tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for customers table
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);

-- ============================================
-- 8. LOGS TABLE (Activity & Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL, -- 'add', 'update', 'delete', 'sale', 'restock', 'reduce', etc.
    item_id TEXT,
    item_name TEXT,
    details TEXT NOT NULL, -- JSON string with operation details
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    staff_name TEXT,
    quantity INTEGER DEFAULT 0,
    
    -- Transaction Status Tracking
    status TEXT CHECK (status IN ('completed', 'cancelled', 'returned', 'pending')),
    cancellation_reason TEXT,
    cancelled_by TEXT,
    cancelled_at TIMESTAMPTZ
);

-- Indexes for logs table
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_operation ON logs(operation);
CREATE INDEX IF NOT EXISTS idx_logs_item_id ON logs(item_id);
CREATE INDEX IF NOT EXISTS idx_logs_staff_name ON logs(staff_name);

-- ============================================
-- 9. RESTOCKS TABLE (Inventory Replenishment History)
-- ============================================
CREATE TABLE IF NOT EXISTS restocks (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT NOT NULL, -- 'purchase', 'return', 'adjustment', 'supplier-return', etc.
    
    -- Foreign Keys
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE
);

-- Indexes for restocks table
CREATE INDEX IF NOT EXISTS idx_restocks_item_id ON restocks(item_id);
CREATE INDEX IF NOT EXISTS idx_restocks_timestamp ON restocks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_restocks_reason ON restocks(reason);

-- ============================================
-- 10. EMAIL_LOGS TABLE (Email Delivery Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    report_type TEXT, -- 'daily', 'weekly', 'monthly', 'ad-hoc'
    attachments TEXT[], -- Array of attachment URLs/paths
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_logs table
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_report_type ON email_logs(report_type);

-- ============================================
-- 11. EMAIL_SCHEDULES TABLE (Scheduled Email Reports)
-- ============================================
CREATE TABLE IF NOT EXISTS email_schedules (
    id TEXT PRIMARY KEY,
    recipient_email TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    time_of_day TEXT NOT NULL, -- Format: 'HH:MM' (24-hour format)
    day_of_week INTEGER, -- 0 = Sunday, 6 = Saturday (for weekly reports)
    day_of_month INTEGER, -- 1-31 (for monthly reports)
    enabled BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMPTZ,
    next_scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_schedules table
CREATE INDEX IF NOT EXISTS idx_email_schedules_enabled ON email_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_email_schedules_next_scheduled ON email_schedules(next_scheduled_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_email_schedules_recipient ON email_schedules(recipient_email);

-- ============================================
-- DATABASE VIEWS
-- ============================================

-- View: products_unified (Unified view of inventory items and bundles)
-- Note: This view combines regular products and bundles for easy querying
CREATE OR REPLACE VIEW products_unified AS
SELECT 
    id,
    name,
    category,
    store,
    sales_channel,
    quantity,
    cost_price,
    selling_price,
    reorder_level,
    total_cogs,
    sku,
    discount,
    discount_type,
    discount_end_date,
    min_price,
    images,
    image_url,
    product_type,
    item_status,
    bad_item_reason,
    bad_item_quantity,
    bad_items_breakdown,
    last_updated,
    created_at
FROM inventory
ORDER BY name ASC;

-- ============================================
-- STORED PROCEDURES & FUNCTIONS
-- ============================================

-- Function: Update inventory last_updated timestamp on row modification
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Automatically update last_updated on inventory changes
DROP TRIGGER IF EXISTS trigger_update_inventory_timestamp ON inventory;
CREATE TRIGGER trigger_update_inventory_timestamp
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_timestamp();

-- Function: Update users updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION update_users_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Automatically update updated_at on users changes
DROP TRIGGER IF EXISTS trigger_update_users_timestamp ON users;
CREATE TRIGGER trigger_update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_timestamp();

-- Function: Update orders updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION update_orders_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Automatically update updated_at on orders changes
DROP TRIGGER IF EXISTS trigger_update_orders_timestamp ON orders;
CREATE TRIGGER trigger_update_orders_timestamp
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_timestamp();

-- Function: Update customers updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION update_customers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Automatically update updated_at on customers changes
DROP TRIGGER IF EXISTS trigger_update_customers_timestamp ON customers;
CREATE TRIGGER trigger_update_customers_timestamp
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_timestamp();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Note: Uncomment and customize these policies based on your security requirements

-- Enable RLS on all tables (optional, configure based on needs)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE restocks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE email_schedules ENABLE ROW LEVEL SECURITY;

-- Example RLS Policy: Admin users can access all records
-- CREATE POLICY admin_all ON users FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Example RLS Policy: Operations users can only access their assigned channel
-- CREATE POLICY operations_channel ON orders FOR SELECT USING (
--     auth.jwt() ->> 'role' = 'operations' AND 
--     sales_channel = auth.jwt() ->> 'assigned_channel'
-- );

-- ============================================
-- DEFAULT DATA (SAMPLE)
-- ============================================

-- Insert default admin account (password: admin123 - CHANGE IN PRODUCTION!)
-- Password hash generated with bcrypt (rounds=10)
INSERT INTO users (id, username, password, role, display_name, created_at) 
VALUES (
    'USR-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8),
    'admin',
    '$2a$10$rHqVqxPTmH0pR4YxGX5jLuOhQmvVYJ5jB5yLqKj3xGMZUDKZ5K0Qq', -- Hashed 'admin123'
    'admin',
    'System Administrator',
    NOW()
) ON CONFLICT (username) DO NOTHING;

-- Insert default categories
INSERT INTO categories (id, name, created_at) VALUES
    ('CAT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Electronics', NOW()),
    ('CAT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Clothing', NOW()),
    ('CAT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Food & Beverages', NOW()),
    ('CAT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Home & Garden', NOW()),
    ('CAT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Beauty & Health', NOW())
ON CONFLICT DO NOTHING;

-- Insert default stores
INSERT INTO stores (id, store_name, sales_channel, created_at) VALUES
    ('STORE-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Shopee Main', 'Shopee', NOW()),
    ('STORE-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Lazada Main', 'Lazada', NOW()),
    ('STORE-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Facebook Shop', 'Facebook', NOW()),
    ('STORE-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'TikTok Shop', 'TikTok', NOW()),
    ('STORE-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Main Warehouse', 'Physical Store', NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- USEFUL QUERIES
-- ============================================

-- Query: Get low stock items
-- SELECT * FROM inventory WHERE quantity <= reorder_level AND item_status = 'good';

-- Query: Get total revenue for current month
-- SELECT SUM(total) as monthly_revenue 
-- FROM orders 
-- WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
-- AND status = 'Packed'
-- AND parcel_status NOT IN ('CANCELLED', 'RETURNED')
-- AND deleted_at IS NULL;

-- Query: Get top selling products
-- SELECT product_name, SUM(qty) as total_sold, SUM(total) as total_revenue
-- FROM orders
-- WHERE status = 'Packed' 
-- AND parcel_status NOT IN ('CANCELLED', 'RETURNED')
-- AND deleted_at IS NULL
-- GROUP BY product_name
-- ORDER BY total_sold DESC
-- LIMIT 10;

-- Query: Get order cancellation rate
-- SELECT 
--     COUNT(*) FILTER (WHERE is_cancelled = true OR parcel_status = 'CANCELLED') * 100.0 / COUNT(*) as cancellation_rate
-- FROM orders
-- WHERE deleted_at IS NULL;

-- Query: Get sales by channel
-- SELECT sales_channel, COUNT(*) as orders, SUM(total) as revenue
-- FROM orders
-- WHERE status = 'Packed'
-- AND parcel_status NOT IN ('CANCELLED', 'RETURNED')
-- AND deleted_at IS NULL
-- GROUP BY sales_channel
-- ORDER BY revenue DESC;

-- ============================================
-- BACKUP & MAINTENANCE RECOMMENDATIONS
-- ============================================

-- 1. Regular Backups:
--    - Daily automated backups of all tables
--    - Keep backups for at least 30 days
--    - Test restore procedures monthly

-- 2. Index Maintenance:
--    - REINDEX tables monthly
--    - VACUUM ANALYZE weekly
--    - Monitor index usage with pg_stat_user_indexes

-- 3. Data Retention:
--    - Archive old logs after 1 year
--    - Archive completed orders after 2 years
--    - Keep financial data indefinitely

-- 4. Performance Monitoring:
--    - Monitor slow queries (> 1 second)
--    - Check table bloat monthly
--    - Review connection pool usage

-- 5. Security Audits:
--    - Review user permissions quarterly
--    - Rotate database passwords annually
--    - Audit sensitive data access logs

-- ============================================
-- END OF SCHEMA
-- ============================================

-- Schema Version: 1.0.0
-- Last Updated: August 20, 2026
-- Total Tables: 11
-- Total Views: 1
-- Total Indexes: 50+
-- Database: PostgreSQL 15+ (Supabase)
