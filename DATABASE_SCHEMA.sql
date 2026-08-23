-- ============================================
-- COMPLETE SQL SCHEMA - INVENTORY MANAGEMENT SYSTEM
-- Database: PostgreSQL (Supabase)
-- Updated: August 23, 2026
-- Based on: Admin frontend pages only
-- Tables: 9
-- ============================================

-- ============================================
-- 1. USERS
-- Used by: Login, Settings > Users, Profile, Session
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,                        -- bcrypt hashed
    role TEXT NOT NULL CHECK (role IN ('admin', 'logistics-admin')),
    display_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    profile_image TEXT,                            -- URL to Supabase Storage

    -- Single-device session
    active_session_id TEXT,
    session_created_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active_session ON users(active_session_id);

CREATE OR REPLACE FUNCTION update_users_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_users_timestamp ON users;
CREATE TRIGGER trigger_update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_users_timestamp();


-- ============================================
-- 2. CATEGORIES
-- Used by: Inventory page (filter + manage)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);


-- ============================================
-- 3. INVENTORY
-- Used by: Inventory page, POS, Dashboard
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    cost_price DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    reorder_level INTEGER NOT NULL DEFAULT 10,
    total_cogs DECIMAL(10,2) NOT NULL DEFAULT 0,
    sku TEXT,
    image_url TEXT,                                -- Supabase Storage URL
    product_type TEXT DEFAULT 'regular' CHECK (product_type IN ('regular', 'bundle')),

    -- Bad stock tracking
    item_status TEXT DEFAULT 'good' CHECK (item_status IN ('good', 'bad')),
    bad_item_reason TEXT,
    bad_item_quantity INTEGER DEFAULT 0,
    bad_items_breakdown JSONB DEFAULT '{}',        -- e.g. {"damage": 10, "defect": 5}

    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (category) REFERENCES categories(name) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(name);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_product_type ON inventory(product_type);
CREATE INDEX IF NOT EXISTS idx_inventory_item_status ON inventory(item_status);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(quantity, reorder_level) WHERE quantity <= reorder_level;
CREATE INDEX IF NOT EXISTS idx_inventory_bad_items ON inventory USING gin(bad_items_breakdown);

CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.last_updated = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_timestamp ON inventory;
CREATE TRIGGER trigger_update_inventory_timestamp
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_inventory_timestamp();


-- ============================================
-- 4. BUNDLES
-- Used by: Inventory (bundle products), POS
-- ============================================
CREATE TABLE IF NOT EXISTS bundles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    bundle_price DECIMAL(10,2) NOT NULL,
    bundle_cost DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 5,
    sku TEXT UNIQUE,
    is_active BOOLEAN DEFAULT true,
    image_url TEXT,
    badge TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bundles_category ON bundles(category);
CREATE INDEX IF NOT EXISTS idx_bundles_active ON bundles(is_active);

-- Bundle components
CREATE TABLE IF NOT EXISTS bundle_items (
    id TEXT PRIMARY KEY,
    bundle_id TEXT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bundle_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_item ON bundle_items(item_id);


-- ============================================
-- 5. ORDERS
-- Used by: Dashboard (revenue/KPIs), POS (creates orders), Sales page, Orders page
-- Simple order tracking for POS sales
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL,
    qty INTEGER NOT NULL,
    cogs DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    product TEXT NOT NULL,
    
    -- Staff
    dispatched_by TEXT,

    -- Waybill tracking
    waybill_number TEXT,

    -- Cancellation tracking
    is_cancelled BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT,
    cancellation_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_dispatched_by ON orders(dispatched_by);
CREATE INDEX IF NOT EXISTS idx_orders_waybill ON orders(waybill_number);
CREATE INDEX IF NOT EXISTS idx_orders_is_cancelled ON orders(is_cancelled);
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON orders(cancelled_at);

CREATE OR REPLACE FUNCTION update_orders_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_orders_timestamp ON orders;
CREATE TRIGGER trigger_update_orders_timestamp
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_orders_timestamp();


-- ============================================
-- 6. TRANSACTIONS
-- Used by: POS (creates), Logs page, Dashboard
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    total_revenue DECIMAL(10,2) NOT NULL,
    profit DECIMAL(10,2) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('sale', 'restock')),
    staff_name TEXT,
    notes TEXT,
    waybill_number TEXT,

    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_waybill ON transactions(waybill_number);


-- ============================================
-- 7. RESTOCKS
-- Used by: Dashboard (recent restocks), Inventory (restock/reduce)
-- ============================================
CREATE TABLE IF NOT EXISTS restocks (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT NOT NULL,

    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_restocks_item_id ON restocks(item_id);
CREATE INDEX IF NOT EXISTS idx_restocks_timestamp ON restocks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_restocks_reason ON restocks(reason);


-- ============================================
-- 8. CUSTOMERS
-- Used by: Customers page (full CRUD)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    loyalty_points INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    last_purchase TIMESTAMPTZ,
    tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);

CREATE OR REPLACE FUNCTION update_customers_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customers_timestamp ON customers;
CREATE TRIGGER trigger_update_customers_timestamp
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_customers_timestamp();


-- ============================================
-- 9. LOGS
-- Used by: Log page (full audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    item_id TEXT,
    item_name TEXT,
    details TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    staff_name TEXT,
    quantity INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('completed', 'cancelled', 'returned', 'pending')),
    cancellation_reason TEXT,
    cancelled_by TEXT,
    cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_operation ON logs(operation);
CREATE INDEX IF NOT EXISTS idx_logs_item_id ON logs(item_id);
CREATE INDEX IF NOT EXISTS idx_logs_staff_name ON logs(staff_name);


-- ============================================
-- 10. FREEBIES
-- Used by: POS (freebie toggle)
-- ============================================
CREATE TABLE IF NOT EXISTS freebies (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES inventory(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    cost_price DECIMAL(10,2) NOT NULL,
    total_cogs DECIMAL(10,2) NOT NULL,
    given_with_sale_id TEXT,
    reason TEXT,
    dispatched_by TEXT NOT NULL,
    dispatched_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freebies_dispatched_date ON freebies(dispatched_date);
CREATE INDEX IF NOT EXISTS idx_freebies_item_id ON freebies(item_id);
CREATE INDEX IF NOT EXISTS idx_freebies_dispatched_by ON freebies(dispatched_by);


-- ============================================
-- 11. NOTIFICATIONS
-- Used by: Notification system (low stock, new orders)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('order', 'inventory', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = false;


-- ============================================
-- VIEW: products_unified
-- Combines inventory for POS and Inventory page
-- ============================================
CREATE OR REPLACE VIEW products_unified AS
SELECT
    id,
    name,
    category,
    quantity,
    cost_price,
    selling_price,
    reorder_level,
    total_cogs,
    sku,
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
-- DEFAULT DATA
-- ============================================

-- Default admin account (password: admin123 — CHANGE THIS IN PRODUCTION)
INSERT INTO users (id, username, password, role, display_name, created_at)
VALUES (
    'USR-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8),
    'admin',
    '$2a$10$rHqVqxPTmH0pR4YxGX5jLuOhQmvVYJ5jB5yLqKj3xGMZUDKZ5K0Qq',
    'admin',
    'System Administrator',
    NOW()
) ON CONFLICT (username) DO NOTHING;

-- Default categories
INSERT INTO categories (id, name, created_at) VALUES
    ('CAT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Electronics', NOW()),
    ('CAT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Clothing', NOW()),
    ('CAT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Food & Beverages', NOW()),
    ('CAT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Home & Garden', NOW()),
    ('CAT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8), 'Beauty & Health', NOW())
ON CONFLICT DO NOTHING;


-- ============================================
-- USEFUL QUERIES
-- ============================================

-- Low stock items
-- SELECT * FROM inventory WHERE quantity <= reorder_level AND item_status = 'good';

-- Total revenue this month (active orders only)
-- SELECT SUM(total) FROM orders
-- WHERE DATE_TRUNC('month', packed_at) = DATE_TRUNC('month', NOW())
-- AND status = 'Packed'
-- AND parcel_status NOT IN ('CANCELLED', 'RETURNED')
-- AND deleted_at IS NULL;

-- Top selling products
-- SELECT product_name, SUM(qty) AS total_sold, SUM(total) AS total_revenue
-- FROM orders
-- WHERE status = 'Packed'
-- AND parcel_status NOT IN ('CANCELLED', 'RETURNED')
-- AND deleted_at IS NULL
-- GROUP BY product_name
-- ORDER BY total_sold DESC LIMIT 10;

-- Cancellation rate
-- SELECT
--   COUNT(*) FILTER (WHERE is_cancelled = true OR parcel_status = 'CANCELLED') * 100.0 / COUNT(*) AS rate
-- FROM orders WHERE deleted_at IS NULL;

-- Bad stock report
-- SELECT name, bad_item_quantity, bad_item_reason, bad_items_breakdown
-- FROM inventory WHERE item_status = 'bad';


-- ============================================
-- REMOVED (no longer in frontend)
-- ============================================
-- DROP TABLE IF EXISTS stores CASCADE;
-- DROP TABLE IF EXISTS email_logs CASCADE;
-- DROP TABLE IF EXISTS email_schedules CASCADE;
-- DROP TABLE IF EXISTS email_report_schedules CASCADE;
-- DROP TABLE IF EXISTS email_report_logs CASCADE;

-- Removed columns:
-- inventory: store, sales_channel, discount, discount_type, discount_end_date, min_price, images
-- orders: store, sales_channel, confirmation_status, agent_username
-- bundles: store, sales_channel, regular_price, savings
-- users: assigned_channel
-- transactions: customer_id, customer_phone, customer_email, customer_address, discount, discount_amount


-- ============================================
-- Schema Version: 3.0.0
-- Updated: August 23, 2026
-- Tables: 11 (users, categories, inventory, bundles,
--          bundle_items, orders, transactions, restocks,
--          customers, logs, freebies, notifications)
-- Views: 1 (products_unified)
-- Triggers: 4 (users, inventory, orders, customers)
-- ============================================
