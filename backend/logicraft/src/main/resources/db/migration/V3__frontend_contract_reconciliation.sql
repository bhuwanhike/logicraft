-- V4__frontend_contract_reconciliation.sql

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm extension not available, skipping...';
END $$;

-- ───────────────────────── tenancy ─────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    timezone      VARCHAR(64)  NOT NULL DEFAULT 'UTC',
    distance_unit VARCHAR(8)   NOT NULL DEFAULT 'km',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT workspaces_distance_unit_ck CHECK (distance_unit IN ('km','mi'))
);

INSERT INTO workspaces (id, name, timezone, distance_unit)
VALUES (1, 'Default Workspace', 'UTC', 'km')
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────── identity ─────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS workspace_id BIGINT DEFAULT 1 REFERENCES workspaces(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS name         VARCHAR(150),
    ADD COLUMN IF NOT EXISTS company      VARCHAR(150),
    ADD COLUMN IF NOT EXISTS status       VARCHAR(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

UPDATE users SET name = btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) WHERE name IS NULL;
ALTER TABLE users ALTER COLUMN name SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_ck;
ALTER TABLE users ADD CONSTRAINT users_status_ck
    CHECK (status IN ('active','invited','suspended','disabled'));

ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(60) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS rank         SMALLINT NOT NULL DEFAULT 100;

UPDATE roles SET display_name = regexp_replace(name, '^ROLE_', '') WHERE display_name = '';
UPDATE roles SET display_name = 'Platform Administrator' WHERE name = 'ROLE_SUPER_ADMIN';
UPDATE roles SET display_name = 'Operations Manager'  WHERE name = 'ROLE_ORG_ADMIN';
UPDATE roles SET display_name = 'Fleet Supervisor'    WHERE name = 'ROLE_FLEET_MANAGER';
UPDATE roles SET display_name = 'Warehouse Lead'      WHERE name = 'ROLE_WAREHOUSE_MANAGER';
UPDATE roles SET display_name = 'Warehouse Associate' WHERE name = 'ROLE_WAREHOUSE_STAFF';

INSERT INTO roles (name, display_name, rank) VALUES
    ('ROLE_ANALYST', 'Data Analyst', 400),
    ('ROLE_VIEWER',  'Viewer',       500)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    issued_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    user_agent VARCHAR(255),
    ip         VARCHAR(45)
);

-- ───────────────────────── fleet ─────────────────────────
ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS workspace_id     BIGINT DEFAULT 1 REFERENCES workspaces(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS vin              VARCHAR(17) UNIQUE,
    ADD COLUMN IF NOT EXISTS make             VARCHAR(60),
    ADD COLUMN IF NOT EXISTS year             SMALLINT,
    ADD COLUMN IF NOT EXISTS current_driver_id BIGINT,
    ADD COLUMN IF NOT EXISTS fuel_level       SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS odometer_km      NUMERIC(12,1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_service_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_service_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS location_label   VARCHAR(160),
    ADD COLUMN IF NOT EXISTS lat              NUMERIC(9,6),
    ADD COLUMN IF NOT EXISTS lng              NUMERIC(9,6),
    ADD COLUMN IF NOT EXISTS acquired_at      TIMESTAMPTZ;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='plate_number') THEN
        ALTER TABLE vehicles RENAME COLUMN plate_number TO plate;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='vehicle_type') THEN
        ALTER TABLE vehicles RENAME COLUMN vehicle_type TO type;
    END IF;
END $$;

UPDATE vehicles SET type = CASE type
    WHEN 'Heavy Truck'   THEN 'truck'
    WHEN 'Delivery Van'  THEN 'van'
    WHEN 'Cargo Plane'   THEN 'air'
    WHEN 'Freight Train' THEN 'rail'
    ELSE lower(replace(type, ' ', '_')) END;

UPDATE vehicles SET make = split_part(model, ' ', 1),
                    model = NULLIF(substr(model, strpos(model, ' ') + 1), '')
WHERE make IS NULL AND model IS NOT NULL;

-- Safely map V2 vehicle status to frontend allowed enum
UPDATE vehicles SET status = CASE lower(status)
    WHEN 'available' THEN 'active'
    WHEN 'in_transit' THEN 'active'
    WHEN 'maintenance' THEN 'maintenance'
    WHEN 'idle' THEN 'idle'
    WHEN 'out_of_service' THEN 'out_of_service'
    ELSE 'active' END;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_type_ck;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_status_ck;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_fuel_ck;

ALTER TABLE vehicles
    ADD CONSTRAINT vehicles_type_ck   CHECK (type IN ('van','truck','trailer','reefer')),
    ADD CONSTRAINT vehicles_status_ck CHECK (status IN ('active','idle','maintenance','out_of_service')),
    ADD CONSTRAINT vehicles_fuel_ck   CHECK (fuel_level BETWEEN 0 AND 100);

-- ───────────────────────── drivers ─────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    BIGINT NOT NULL DEFAULT 1 REFERENCES workspaces(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(150),
    phone           VARCHAR(40),
    status          VARCHAR(20) NOT NULL DEFAULT 'off_duty',
    license_number  VARCHAR(60) UNIQUE,
    license_expiry  DATE,
    safety_score    SMALLINT NOT NULL DEFAULT 100,
    rating          NUMERIC(2,1),
    trips_completed INTEGER NOT NULL DEFAULT 0,
    weekly_hours    NUMERIC(4,1) NOT NULL DEFAULT 0,
    certifications  TEXT[] NOT NULL DEFAULT '{}',
    joined_at       DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT drivers_status_ck CHECK (status IN ('available','on_route','off_duty','suspended')),
    CONSTRAINT drivers_safety_ck CHECK (safety_score BETWEEN 0 AND 100),
    CONSTRAINT drivers_rating_ck CHECK (rating IS NULL OR rating BETWEEN 0 AND 5)
);

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_driver_fk;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_driver_fk
    FOREIGN KEY (current_driver_id) REFERENCES drivers(id) ON DELETE SET NULL;

-- ───────────────────────── warehouse ─────────────────────────
ALTER TABLE warehouses
    ADD COLUMN IF NOT EXISTS workspace_id   BIGINT DEFAULT 1 REFERENCES workspaces(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS status         VARCHAR(20) NOT NULL DEFAULT 'operational',
    ADD COLUMN IF NOT EXISTS total_capacity INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS used_capacity  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lat            NUMERIC(9,6),
    ADD COLUMN IF NOT EXISTS lng            NUMERIC(9,6),
    ADD COLUMN IF NOT EXISTS address        VARCHAR(255);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warehouses' AND column_name='capacity_sqft') THEN
        UPDATE warehouses SET total_capacity = capacity_sqft;
        ALTER TABLE warehouses DROP COLUMN capacity_sqft;
    END IF;
END $$;

ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_status_ck;
ALTER TABLE warehouses ADD CONSTRAINT warehouses_status_ck
    CHECK (status IN ('operational','maintenance','closed'));

CREATE TABLE IF NOT EXISTS zones (
    id              BIGSERIAL PRIMARY KEY,
    warehouse_id    BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    code            VARCHAR(20) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    capacity_units INTEGER NOT NULL DEFAULT 0,
    used_capacity   INTEGER NOT NULL DEFAULT 0,
    dock_doors      SMALLINT NOT NULL DEFAULT 0,
    temperature_controlled BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (warehouse_id, code),
    CONSTRAINT zones_status_ck CHECK (status IN ('active','congested','closed','maintenance'))
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id                BIGSERIAL PRIMARY KEY,
    warehouse_id      BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    zone_id           BIGINT REFERENCES zones(id) ON DELETE SET NULL,
    sku               VARCHAR(64) NOT NULL,
    name              VARCHAR(160) NOT NULL,
    unit              VARCHAR(16) NOT NULL DEFAULT 'unit',
    quantity          INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_point     INTEGER NOT NULL DEFAULT 0,
    reorder_quantity  INTEGER NOT NULL DEFAULT 0,
    bin_location      VARCHAR(40),
    weight_kg         NUMERIC(10,2),
    last_movement_at  TIMESTAMPTZ,
    UNIQUE (warehouse_id, sku),
    CONSTRAINT inventory_items_qty_ck
        CHECK (quantity >= 0 AND reserved_quantity >= 0 AND reserved_quantity <= quantity)
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id            BIGSERIAL PRIMARY KEY,
    item_id       BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    warehouse_id  BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    kind          VARCHAR(20) NOT NULL,
    delta         INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reference     VARCHAR(80),
    description   VARCHAR(255),
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT stock_movements_kind_ck  CHECK (kind IN
        ('receive','dispatch','adjust','transfer','return','write_off')),
    CONSTRAINT stock_movements_delta_ck CHECK (delta <> 0)
);

-- ───────────────────────── shipments ─────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='tracking_id') THEN
        ALTER TABLE shipments RENAME COLUMN tracking_id TO reference;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='estimated_delivery') THEN
        ALTER TABLE shipments RENAME COLUMN estimated_delivery TO eta;
    END IF;
END $$;

ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS workspace_id BIGINT NOT NULL DEFAULT 1 REFERENCES workspaces(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS mode         VARCHAR(10) NOT NULL DEFAULT 'road',
    ADD COLUMN IF NOT EXISTS driver_id    BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS vehicle_id   BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS origin_warehouse_id      BIGINT REFERENCES warehouses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS destination_warehouse_id BIGINT REFERENCES warehouses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS exception_kind VARCHAR(20),
    ADD COLUMN IF NOT EXISTS exception_note TEXT;

UPDATE shipments SET status = 'exception' WHERE status = 'FAILED';
UPDATE shipments SET status = lower(status);

ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_ck;
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_mode_ck;

ALTER TABLE shipments
    ADD CONSTRAINT shipments_status_ck CHECK (status IN
        ('created','picked_up','in_transit','out_for_delivery','delivered','exception','cancelled')),
    ADD CONSTRAINT shipments_mode_ck CHECK (mode IN ('road','air','sea','rail'));

CREATE TABLE IF NOT EXISTS shipment_milestones (
    id          BIGSERIAL PRIMARY KEY,
    shipment_id BIGINT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    status      VARCHAR(24) NOT NULL,
    at          TIMESTAMPTZ,
    location    VARCHAR(160),
    note        TEXT,
    latitude    NUMERIC(9,6),
    longitude   NUMERIC(9,6),
    seq         SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT shipment_milestones_status_ck CHECK (status IN
        ('created','picked_up','in_transit','out_for_delivery','delivered','exception'))
);

-- ───────────────────────── tracking ─────────────────────────
CREATE TABLE IF NOT EXISTS trips (
    id               BIGSERIAL PRIMARY KEY,
    workspace_id     BIGINT NOT NULL DEFAULT 1 REFERENCES workspaces(id) ON DELETE CASCADE,
    reference        VARCHAR(60) NOT NULL UNIQUE,
    shipment_id      BIGINT REFERENCES shipments(id) ON DELETE SET NULL,
    vehicle_id       BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id        BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'planned',
    plate            VARCHAR(20) NOT NULL,
    origin           VARCHAR(160) NOT NULL,
    destination      VARCHAR(160) NOT NULL,
    lat              NUMERIC(9,6),
    lng              NUMERIC(9,6),
    heading_deg      SMALLINT,
    speed_kph        NUMERIC(6,1),
    fuel_level       SMALLINT,
    distance_km      NUMERIC(10,1),
    eta              TIMESTAMPTZ,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    last_reported_at TIMESTAMPTZ,
    CONSTRAINT trips_status_ck CHECK (status IN ('planned','active','delayed','completed','cancelled'))
);

CREATE TABLE IF NOT EXISTS trip_telemetry_samples (
    id          BIGSERIAL PRIMARY KEY,
    trip_id     BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    at          TIMESTAMPTZ NOT NULL,
    lat         NUMERIC(9,6),
    lng         NUMERIC(9,6),
    speed_kph   NUMERIC(6,1),
    fuel_level  SMALLINT,
    heading_deg SMALLINT,
    UNIQUE (trip_id, at)
);

-- ───────────────────────── events ─────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id           BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL DEFAULT 1 REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      BIGINT REFERENCES users(id) ON DELETE CASCADE,
    level        VARCHAR(12) NOT NULL DEFAULT 'info',
    title        VARCHAR(160) NOT NULL,
    body         TEXT,
    entity_type  VARCHAR(20),
    entity_id    BIGINT,
    reference    VARCHAR(60),
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    read_at      TIMESTAMPTZ,
    raised_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT notifications_level_ck  CHECK (level IN ('critical','warning','info'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT DEFAULT 1 REFERENCES workspaces(id) ON DELETE CASCADE,
    actor_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    actor_name   VARCHAR(150) NOT NULL,
    actor_role   VARCHAR(60),
    action       VARCHAR(60) NOT NULL,
    entity_type  VARCHAR(40) NOT NULL,
    entity_id    VARCHAR(60),
    summary      VARCHAR(255),
    changes      JSONB,
    ip           VARCHAR(45),
    user_agent   VARCHAR(255),
    at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION reject_mutation() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION '% is append-only (attempted %)', TG_TABLE_NAME, TG_OP; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

DROP TRIGGER IF EXISTS stock_movements_immutable ON stock_movements;
CREATE TRIGGER stock_movements_immutable BEFORE UPDATE OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ───────────────────────── reporting ─────────────────────────
CREATE TABLE IF NOT EXISTS metric_daily_rollup (
    id                     BIGSERIAL PRIMARY KEY,
    workspace_id           BIGINT NOT NULL DEFAULT 1 REFERENCES workspaces(id) ON DELETE CASCADE,
    facility_id            BIGINT NOT NULL DEFAULT 0,
    day                    DATE NOT NULL,
    mode                   VARCHAR(10) NOT NULL DEFAULT 'all',
    created_count          INTEGER NOT NULL DEFAULT 0,
    picked_up_count        INTEGER NOT NULL DEFAULT 0,
    in_transit_count       INTEGER NOT NULL DEFAULT 0,
    out_for_delivery_count INTEGER NOT NULL DEFAULT 0,
    delivered_count        INTEGER NOT NULL DEFAULT 0,
    exception_count        INTEGER NOT NULL DEFAULT 0,
    on_time_count          INTEGER NOT NULL DEFAULT 0,
    total_shipments        INTEGER NOT NULL DEFAULT 0,
    transit_hours_sum      NUMERIC(12,2) NOT NULL DEFAULT 0,
    shipping_cost_sum      NUMERIC(14,2) NOT NULL DEFAULT 0,
    UNIQUE (workspace_id, facility_id, day, mode),
    CONSTRAINT metric_daily_rollup_mode_ck
        CHECK (mode IN ('all','road','air','sea','rail'))
);
