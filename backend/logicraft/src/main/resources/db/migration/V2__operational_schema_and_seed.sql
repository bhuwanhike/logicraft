-- Operational Tables

CREATE TABLE warehouses (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    capacity_sqft INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicles (
    id BIGSERIAL PRIMARY KEY,
    plate_number VARCHAR(20) NOT NULL UNIQUE,
    model VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(30) NOT NULL,
    capacity_kg DECIMAL(10,2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shipments (
    id BIGSERIAL PRIMARY KEY,
    tracking_id VARCHAR(50) NOT NULL UNIQUE,
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    weight_kg DECIMAL(10,2) NOT NULL,
    estimated_delivery TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Baseline Seed Data

INSERT INTO warehouses (name, location, capacity_sqft) VALUES
    ('Central Logistics Hub', 'Chicago, IL', 50000),
    ('West Coast Hub', 'Los Angeles, CA', 35000),
    ('East Coast Facility', 'Newark, NJ', 42000);

INSERT INTO vehicles (plate_number, model, vehicle_type, capacity_kg, status) VALUES
    ('TRK-1001', 'Volvo FH16', 'Heavy Truck', 20000.00, 'IN_TRANSIT'),
    ('VAN-2004', 'Mercedes Sprinter', 'Delivery Van', 3500.00, 'AVAILABLE'),
    ('TRK-1008', 'Freightliner Cascadia', 'Heavy Truck', 22000.00, 'MAINTENANCE');

INSERT INTO shipments (tracking_id, origin, destination, status, weight_kg, estimated_delivery) VALUES
    ('LOG-8841-X', 'Chicago, IL', 'Los Angeles, CA', 'IN_TRANSIT', 1250.50, NOW() + INTERVAL '2 days'),
    ('LOG-9021-Y', 'Newark, NJ', 'Chicago, IL', 'PICKED_UP', 450.00, NOW() + INTERVAL '1 day'),
    ('LOG-3310-Z', 'Los Angeles, CA', 'Seattle, WA', 'DELIVERED', 890.25, NOW() - INTERVAL '1 day');
