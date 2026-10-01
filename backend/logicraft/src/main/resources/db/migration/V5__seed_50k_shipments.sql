-- Seed default workspace for multi-tenancy requirement
INSERT INTO workspaces (id, name, timezone, distance_unit)
VALUES (1, 'Default Workspace', 'UTC', 'km')
ON CONFLICT (id) DO NOTHING;

-- Generate 50,000 frontend-compliant shipments
INSERT INTO shipments (
    workspace_id,
    reference,
    origin,
    destination,
    weight_kg,
    status,
    mode,
    eta,
    created_at
)
SELECT
    1 AS workspace_id,
    'LOG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)) || '-' || LPAD(s.i::TEXT, 5, '0') AS reference,
    (ARRAY['Chicago, IL', 'Los Angeles, CA', 'Newark, NJ', 'Houston, TX', 'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX'])[FLOOR(RANDOM() * 7 + 1)] AS origin,
    (ARRAY['Seattle, WA', 'Miami, FL', 'Denver, CO', 'Boston, MA', 'Atlanta, GA', 'San Francisco, CA', 'Detroit, MI'])[FLOOR(RANDOM() * 7 + 1)] AS destination,
    ROUND((RANDOM() * 1500 + 10)::NUMERIC, 2) AS weight_kg,
    (ARRAY['created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'cancelled'])[FLOOR(RANDOM() * 7 + 1)] AS status,
    (ARRAY['road', 'air', 'sea', 'rail'])[FLOOR(RANDOM() * 4 + 1)] AS mode,
    NOW() + (s.i * INTERVAL '1 second') + ((RANDOM() * 10) * INTERVAL '1 day') AS eta,
    NOW() - ((RANDOM() * 60) * INTERVAL '1 day') AS created_at
FROM generate_series(1, 50000) s(i);
