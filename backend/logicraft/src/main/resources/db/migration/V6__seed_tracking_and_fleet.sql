-- Seed Drivers
INSERT INTO drivers (id, workspace_id, name, email, phone, status, license_number, safety_score, rating, trips_completed)
VALUES
  (1, 1, 'John Doe', 'john.doe@logicraft.io', '+1-555-0192', 'on_route', 'DL-994821', 98, 4.9, 142),
  (2, 1, 'Sarah Connor', 'sarah.c@logicraft.io', '+1-555-0183', 'available', 'DL-882103', 95, 4.8, 89),
  (3, 1, 'Mike Ross', 'mike.r@logicraft.io', '+1-555-0144', 'off_duty', 'DL-331049', 92, 4.7, 54)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  name = EXCLUDED.name;

SELECT setval('drivers_id_seq', COALESCE((SELECT MAX(id) FROM drivers), 1));

-- Seed Vehicles (includes capacity_kg)
INSERT INTO vehicles (id, workspace_id, plate, type, make, model, year, capacity_kg, status, fuel_level, odometer_km, current_driver_id, location_label, lat, lng)
VALUES
  (1, 1, 'TRK-8801', 'truck', 'Volvo', 'FH16', 2022, 15000.00, 'active', 85, 45210.5, 1, 'Chicago, IL', 41.8781, -87.6298),
  (2, 1, 'VAN-2004', 'van', 'Mercedes', 'Sprinter', 2023, 3500.00, 'active', 62, 18400.0, 2, 'Los Angeles, CA', 34.0522, -118.2437),
  (3, 1, 'TRK-9902', 'trailer', 'Freightliner', 'Cascadia', 2021, 25000.00, 'idle', 40, 92100.2, NULL, 'Newark, NJ', 40.7357, -74.1724)
ON CONFLICT (id) DO UPDATE SET
  plate = EXCLUDED.plate,
  type = EXCLUDED.type,
  capacity_kg = EXCLUDED.capacity_kg,
  status = EXCLUDED.status;

SELECT setval('vehicles_id_seq', COALESCE((SELECT MAX(id) FROM vehicles), 1));

-- Seed Active Trips for Tracking Center
INSERT INTO trips (workspace_id, reference, vehicle_id, driver_id, status, plate, origin, destination, lat, lng, speed_kph, fuel_level, eta, last_reported_at)
SELECT
  1 AS workspace_id,
  'TRIP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)) || '-' || LPAD(s.i::TEXT, 3, '0') AS reference,
  1 AS vehicle_id,
  1 AS driver_id,
  'active' AS status,
  'TRK-8801' AS plate,
  'Chicago, IL' AS origin,
  'Los Angeles, CA' AS destination,
  41.8781 + (RANDOM() * 2 - 1) AS lat,
  -87.6298 + (RANDOM() * 2 - 1) AS lng,
  72.5 AS speed_kph,
  85 AS fuel_level,
  NOW() + INTERVAL '12 hours' AS eta,
  NOW() AS last_reported_at
FROM generate_series(1, 15) s(i)
ON CONFLICT (reference) DO NOTHING;
