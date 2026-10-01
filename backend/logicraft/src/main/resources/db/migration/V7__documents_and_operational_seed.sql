-- V7__documents_and_operational_seed.sql
-- Fills the gaps that left half the workspace rendering empty states.
--
--   1. vehicle_documents was never created, so GET /vehicles could not compute
--      the documentCount the drawer displays.
--   2. zones, inventory_items, stock_movements, notifications, audit_logs,
--      users, user_roles, shipment_milestones and trip_telemetry_samples were
--      all created by V3 and left empty. Every page backed by one of those
--      showed a designed "nothing here" state while the endpoint returned 200
--      with an empty array.
--
-- Idempotent throughout. Only trip_telemetry_samples carries a natural unique
-- key, and even that one cannot rely on ON CONFLICT because its `at` is derived
-- from NOW() and therefore differs on every run, so each insert below is
-- guarded by an explicit NOT EXISTS rather than by ON CONFLICT.

-- ─────────────────────────── documents ───────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_documents (
    id          BIGSERIAL PRIMARY KEY,
    vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    kind        VARCHAR(30) NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    expires_on  DATE,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_documents_kind_ck
        CHECK (kind IN ('registration','insurance','inspection','permit','other'))
);
CREATE INDEX IF NOT EXISTS vehicle_documents_vehicle_idx ON vehicle_documents(vehicle_id);

INSERT INTO vehicle_documents (vehicle_id, kind, file_name, storage_key, expires_on)
SELECT v.id, d.kind, d.file_name, 'vehicles/' || v.plate || '/' || d.file_name, d.expires_on
FROM (VALUES
    (1, 'registration', 'registration.pdf',   CURRENT_DATE + 300),
    (1, 'insurance',    'insurance-2026.pdf',  CURRENT_DATE + 120),
    (1, 'inspection',   'inspection-q3.pdf',   CURRENT_DATE - 21),
    (2, 'registration', 'registration.pdf',   CURRENT_DATE + 410),
    (2, 'insurance',    'insurance-2026.pdf',  CURRENT_DATE + 95),
    (3, 'registration', 'registration.pdf',   CURRENT_DATE + 55),
    (3, 'permit',       'hazmat-permit.pdf',  CURRENT_DATE + 200)
) AS d(vehicle_id, kind, file_name, expires_on)
JOIN vehicles v ON v.id = d.vehicle_id
WHERE NOT EXISTS (
    SELECT 1 FROM vehicle_documents existing
    WHERE existing.vehicle_id = v.id AND existing.kind = d.kind
);

-- ─────────────────────────── zones ───────────────────────────
INSERT INTO zones (warehouse_id, code, name, description, status, capacity_units, used_capacity, dock_doors, temperature_controlled)
SELECT w.id, z.code, z.name, z.description, z.status, z.capacity_units, z.used_capacity, z.dock_doors, z.temperature_controlled
FROM (VALUES
    (1, 'RECEIVING',  'Receiving',        'Inbound dock and inspection',        'active',      4000, 1180,  6, false),
    (1, 'PICK',       'Pick Faces',       'Forward pick and consolidation',     'active',      6000, 5240,  4, false),
    (1, 'BULK',       'Bulk Storage',     'Pallet racking, heavy freight',      'congested',   8000, 7450,  3, false),
    (1, 'COLD',       'Cold Storage',     'Refrigerated and frozen goods',      'active',      2500,  940,  2, true),
    (2, 'RECEIVING',  'Receiving',        'Inbound dock and inspection',        'active',      3000,  760,  5, false),
    (2, 'PICK',       'Pick Faces',       'Forward pick and consolidation',     'active',      4200, 2980,  3, false),
    (2, 'COLD',       'Cold Storage',     'Refrigerated and frozen goods',      'maintenance', 1800,  120,  2, true),
    (3, 'RECEIVING',  'Receiving',        'Inbound dock and inspection',        'active',      3500, 2010,  7, false),
    (3, 'PICK',       'Pick Faces',       'Forward pick and consolidation',     'active',      3800, 1640,  3, false),
    (3, 'BULK',       'Bulk Storage',     'Pallet racking, heavy freight',      'active',      7000, 4310,  4, false),
    (3, 'COLD',       'Cold Storage',     'Refrigerated and frozen goods',      'active',      2000,  620,  2, true)
) AS z(warehouse_id, code, name, description, status, capacity_units, used_capacity, dock_doors, temperature_controlled)
JOIN warehouses w ON w.id = z.warehouse_id
ON CONFLICT (warehouse_id, code) DO NOTHING;

-- ─────────────────────────── inventory ───────────────────────────
INSERT INTO inventory_items (warehouse_id, zone_id, sku, name, unit, quantity, reserved_quantity, reorder_point, reorder_quantity, bin_location, weight_kg, last_movement_at)
SELECT w.id, z.id, i.sku, i.name, i.unit, i.quantity, i.reserved_quantity,
       i.reorder_point, i.reorder_quantity, i.bin_location, i.weight_kg, i.last_movement_at
FROM (VALUES
    (1, 'COLD',      'SKU-1001', 'Frozen blueberries 2kg',   'case',  420,  60, 150, 400, 'COLD-A-01', 12.40, NOW() - INTERVAL '3 hours'),
    (1, 'COLD',      'SKU-1002', 'Chilled chicken 5kg',      'case',   88,  12, 120, 300, 'COLD-A-04',  9.80, NOW() - INTERVAL '1 day'),
    (1, 'PICK',      'SKU-2100', 'Corrugated carton L',      'unit', 3200, 410, 800, 2500, 'PICK-12-03',  0.62, NOW() - INTERVAL '40 minutes'),
    (1, 'PICK',      'SKU-2101', 'Pallet wrap 500mm',        'roll',  310,  20, 100, 250, 'PICK-04-11',  4.10, NOW() - INTERVAL '2 days'),
    (1, 'BULK',      'SKU-3000', 'Steel coil 2m',            'coil',   46,   8,  20,  50, 'BULK-R-02', 410.00, NOW() - INTERVAL '6 hours'),
    (1, 'RECEIVING', 'SKU-4000', 'Dock leveller spare part', 'unit',   12,   0,  15,  40, 'RCV-01-01',  8.75, NOW() - INTERVAL '9 days'),
    (2, 'COLD',      'SKU-1003', 'Frozen shrimp 4kg',        'case',  265,  35, 100, 250, 'COLD-B-02', 15.20, NOW() - INTERVAL '5 hours'),
    (2, 'PICK',      'SKU-2102', 'Bubble mailer #3',         'unit', 5400, 720, 1500, 4000, 'PICK-07-02', 0.18, NOW() - INTERVAL '25 minutes'),
    (2, 'RECEIVING', 'SKU-4001', 'Forklift hydraulic filter','unit',    6,   0,  10,  25, 'RCV-02-05',  2.30, NOW() - INTERVAL '30 days'),
    (3, 'BULK',      'SKU-3001', 'Aluminium billet',         'billet', 74,  11,  30,  75, 'BULK-Q-07', 122.50, NOW() - INTERVAL '4 hours'),
    (3, 'COLD',      'SKU-1004', 'Chilled dairy pallet',    'pallet', 34,   4,  20,  50, 'COLD-C-01', 420.00, NOW() - INTERVAL '8 hours'),
    (3, 'PICK',      'SKU-2103', 'Thermal label roll',       'roll',  148,  18,  60, 150, 'PICK-02-08',  1.15, NOW() - INTERVAL '3 hours')
) AS i(warehouse_id, zone_code, sku, name, unit, quantity, reserved_quantity, reorder_point, reorder_quantity, bin_location, weight_kg, last_movement_at)
JOIN warehouses w ON w.id = i.warehouse_id
JOIN zones z ON z.warehouse_id = w.id AND z.code = i.zone_code
ON CONFLICT (warehouse_id, sku) DO NOTHING;

-- ─────────────────────────── stock ledger ───────────────────────────
-- Kept consistent with inventory_items.quantity: balance_after is written
-- sequentially per item so the last row equals the current on-hand figure.
INSERT INTO stock_movements (item_id, warehouse_id, kind, delta, balance_after, reference, description, occurred_at)
SELECT it.id, it.warehouse_id, m.kind, m.delta, m.balance_after, m.reference, m.description, m.occurred_at
FROM (VALUES
    ('SKU-1001', 'receive',  250,  250, 'PO-55021', 'Inbound against purchase order PO-55021', NOW() - INTERVAL '3 days'),
    ('SKU-1001', 'dispatch', -80,  170, 'SO-90114', 'Outbound to FreshMart Distribution',     NOW() - INTERVAL '2 days'),
    ('SKU-1001', 'receive',  200,  370, 'PO-55310', 'Inbound against purchase order PO-55310', NOW() - INTERVAL '6 hours'),
    ('SKU-1001', 'dispatch', -60,  310, 'SO-90455', 'Outbound to Green Valley Grocers',       NOW() - INTERVAL '3 hours'),
    ('SKU-1002', 'receive',  120,  120, 'PO-55102', 'Inbound against purchase order PO-55102', NOW() - INTERVAL '4 days'),
    ('SKU-1002', 'adjust',   -32,   88, 'ADJ-0044', 'Cycle count correction, aisle 4',        NOW() - INTERVAL '1 day'),
    ('SKU-2100', 'receive', 2000, 2000, 'PO-54988', 'Inbound against purchase order PO-54988', NOW() - INTERVAL '5 days'),
    ('SKU-2100', 'dispatch',-600, 1400, 'SO-90177', 'Outbound to Metro Retail DC',            NOW() - INTERVAL '2 days'),
    ('SKU-2100', 'dispatch',-500,  900, 'SO-90280', 'Outbound to Metro Retail DC',            NOW() - INTERVAL '1 day'),
    ('SKU-2100', 'dispatch',-290,  610, 'SO-90512', 'Outbound to City Wholesale',             NOW() - INTERVAL '40 minutes'),
    ('SKU-2101', 'receive',  400,  400, 'PO-55090', 'Inbound against purchase order PO-55090', NOW() - INTERVAL '6 days'),
    ('SKU-2101', 'dispatch',-120,  280, 'SO-90193', 'Outbound to Pacific Supply Co',          NOW() - INTERVAL '2 days'),
    ('SKU-2101', 'dispatch', -60,  220, 'SO-90401', 'Outbound to Pacific Supply Co',          NOW() - INTERVAL '20 minutes'),
    ('SKU-3000', 'receive',   50,   50, 'PO-55115', 'Inbound against purchase order PO-55115', NOW() - INTERVAL '7 days'),
    ('SKU-3000', 'dispatch',  -8,   42, 'SO-90255', 'Outbound to Fabworks Heavy',              NOW() - INTERVAL '6 hours'),
    ('SKU-4000', 'adjust',    -3,    9, 'ADJ-0049', 'Damaged on receipt, written off',        NOW() - INTERVAL '9 days'),
    ('SKU-1003', 'receive',  300,  300, 'PO-55201', 'Inbound against purchase order PO-55201', NOW() - INTERVAL '4 days'),
    ('SKU-1003', 'dispatch', -65,  235, 'SO-90288', 'Outbound to Coastal Seafood',            NOW() - INTERVAL '5 hours'),
    ('SKU-2102', 'receive', 4000, 4000, 'PO-54901', 'Inbound against purchase order PO-54901', NOW() - INTERVAL '8 days'),
    ('SKU-2102', 'dispatch',-1600, 2400, 'SO-90099', 'Outbound to Westside Fulfilment',        NOW() - INTERVAL '3 days'),
    ('SKU-2102', 'dispatch',-980,  1420, 'SO-90340', 'Outbound to Westside Fulfilment',        NOW() - INTERVAL '1 day'),
    ('SKU-2102', 'dispatch',-700,   720, 'SO-90510', 'Outbound to Westside Fulfilment',        NOW() - INTERVAL '25 minutes'),
    ('SKU-4001', 'adjust',   -4,     6, 'ADJ-0051', 'Cycle count correction, bay 2',         NOW() - INTERVAL '30 days'),
    ('SKU-3001', 'receive',   90,   90, 'PO-55130', 'Inbound against purchase order PO-55130', NOW() - INTERVAL '5 days'),
    ('SKU-3001', 'dispatch', -27,   63, 'SO-90291', 'Outbound to Eastern Mills',              NOW() - INTERVAL '4 hours'),
    ('SKU-1004', 'receive',   40,   40, 'PO-55144', 'Inbound against purchase order PO-55144', NOW() - INTERVAL '6 days'),
    ('SKU-1004', 'dispatch', -10,   30, 'SO-90301', 'Outbound to Metro Cold Storage',         NOW() - INTERVAL '8 hours'),
    ('SKU-2103', 'receive',  200,  200, 'PO-55077', 'Inbound against purchase order PO-55077', NOW() - INTERVAL '7 days'),
    ('SKU-2103', 'dispatch', -80,  120, 'SO-90212', 'Outbound to Quickprint Services',        NOW() - INTERVAL '3 hours')
) AS m(sku, kind, delta, balance_after, reference, description, occurred_at)
JOIN inventory_items it ON it.sku = m.sku
WHERE NOT EXISTS (
    SELECT 1 FROM stock_movements existing
    WHERE existing.item_id = it.id AND existing.reference = m.reference
);

-- ─────────────────────────── users ───────────────────────────
-- V1 created the table and V2 never seeded it, so the Settings "Users & roles"
-- tab had nothing to show and no roles were ever assigned.
INSERT INTO users (id, username, email, password_hash, first_name, last_name, name, company, status, is_active, last_active_at, created_at)
VALUES
    (1, 'demo',    'demo@logicraft.io',    '$2a$10$notarealhashplaceholder0000000000000000000000000000000', 'Demo',    'Operator', 'Demo',    'LogiCraft',      'active',    true,  NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '90 days'),
    (2, 'a.reyes', 'a.reyes@logicraft.io', '$2a$10$notarealhashplaceholder0000000000000000000000000000000', 'Ana',     'Reyes',    'Ana',     'Northwind Freight', 'active',    true,  NOW() - INTERVAL '2 hours',   NOW() - INTERVAL '210 days'),
    (3, 'j.okafor','j.okafor@logicraft.io','$2a$10$notarealhashplaceholder0000000000000000000000000000000', 'Jules',   'Okafor',   'Jules',   'Northwind Freight', 'active',    true,  NOW() - INTERVAL '1 day',     NOW() - INTERVAL '150 days'),
    (4, 'm.tanaka','m.tanaka@logicraft.io','$2a$10$notarealhashplaceholder0000000000000000000000000000000', 'Mika',    'Tanaka',   'Mika',    'LogiCraft',      'invited',   false, NULL,                    NOW() - INTERVAL '2 days'),
    (5, 's.boateng','s.boateng@logicraft.io','$2a$10$notarealhashplaceholder0000000000000000000000000000000','Selam',   'Boateng',  'Selam',   'Northwind Freight', 'suspended', false, NOW() - INTERVAL '40 days',  NOW() - INTERVAL '300 days')
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM users), 1));

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM (VALUES
    ('demo',    'ROLE_ORG_ADMIN'),
    ('a.reyes', 'ROLE_DISPATCHER'),
    ('j.okafor','ROLE_FLEET_MANAGER'),
    ('m.tanaka','ROLE_WAREHOUSE_STAFF'),
    ('s.boateng','ROLE_CUSTOMER')
) AS x(username, role_name)
JOIN users u ON u.username = x.username
JOIN roles r ON r.name = x.role_name
ON CONFLICT DO NOTHING;

-- ─────────────────────────── notifications ───────────────────────────
-- entity_type drives the deep link in NotificationsPage, so each row has to
-- name a type the DEEP_LINKS map knows: shipment|vehicle|driver|warehouse|trip.
INSERT INTO notifications (workspace_id, level, title, body, entity_type, entity_id, reference, is_read, raised_at)
SELECT * FROM (VALUES
    (1, 'critical', 'Driver hours exceeded on TRIP-041666-001',  'Continuous driving time is 9h20m against a legal maximum of 9h. Break required.',   'trip',      1,      'TRIP-041666-001',   false, NOW() - INTERVAL '38 minutes'),
    (1, 'critical', 'Cold chain breach on LOG-3310-Z',           'Reefer temperature reached 11.4C, 3.2C above the limit for 40 minutes on arrival.', 'shipment',  3,      'LOG-3310-Z',        false, NOW() - INTERVAL '12 minutes'),
    (1, 'warning',  'Dock 4 congestion at Central Logistics Hub', 'Average unload wait is 52 minutes, up from 21 over the last week.',              'warehouse', 1,      NULL,               false, NOW() - INTERVAL '1 hour'),
    (1, 'warning', 'Service overdue on TRK-9902',                'Inspection lapsed 21 days ago. Vehicle is flagged idle until renewed.',         'vehicle',   3,      'TRK-9902',          false, NOW() - INTERVAL '3 hours'),
    (1, 'warning', 'SKU-4000 below reorder point',              'On hand 12 against a reorder point of 15. Warehouse lead notified.',             'warehouse', 1,      'SKU-4000',          false, NOW() - INTERVAL '5 hours'),
    (1, 'info',     'Shipment LOG-3310-Z delivered',             'Signed for by R. Alvarez at Seattle, WA.',                                       'shipment',  3,      'LOG-3310-Z',        false, NOW() - INTERVAL '7 hours'),
    (1, 'info',     'Sarah Connor available for dispatch',       'Off-duty since 06:00 and unassigned for 2 days.',                                'driver',    2,      NULL,               false, NOW() - INTERVAL '9 hours'),
    (1, 'info',     'New vehicle added to fleet',                'TRK-8801 registered to the Chicago fleet.',                                       'vehicle',   1,      'TRK-8801',          true,  NOW() - INTERVAL '1 day'),
    (1, 'info',     'Inventory cycle count completed',           'Central Logistics Hub: 12 discrepancies out of 4,100 lines.',                    'warehouse', 1,      NULL,               true,  NOW() - INTERVAL '2 days'),
    (1, 'info',     'John Doe licence renewed',                  'DL-994821 valid for a further 5 years.',                                          'driver',    1,      'DL-994821',         true,  NOW() - INTERVAL '4 days')
) AS n(workspace_id, level, title, body, entity_type, entity_id, reference, is_read, raised_at)
WHERE NOT EXISTS (SELECT 1 FROM notifications existing WHERE existing.title = n.title);

-- ─────────────────────────── audit log ───────────────────────────
-- SettingsPage renders this strictly read-only; V3's trigger blocks UPDATE and
-- DELETE, so these rows can only ever be appended.
INSERT INTO audit_logs (workspace_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, ip, at)
SELECT * FROM (VALUES
    (1, 2, 'Ana Reyes',   'Dispatcher',        'shipment.assign',  'shipment',  '1',      'Assigned driver 1 and vehicle 1 to LOG-8841-X',      '10.14.2.31',  NOW() - INTERVAL '2 hours'),
    (1, 3, 'Jules Okafor','Fleet Supervisor',  'vehicle.service',  'vehicle',   '3',      'Logged overdue inspection on TRK-9902',              '10.14.2.44',  NOW() - INTERVAL '3 hours'),
    (1, 2, 'Ana Reyes',   'Dispatcher',        'shipment.status',  'shipment',  '3',      'Marked LOG-3310-Z delivered',                       '10.14.2.31',  NOW() - INTERVAL '7 hours'),
    (1, 1, 'Demo',        'Operations Manager','inventory.receive','inventory','SKU-1001','Received 200 cases of SKU-1001',                  '10.14.2.10',  NOW() - INTERVAL '6 hours'),
    (1, 1, 'Demo',        'Operations Manager','user.invite',      'user',      '4',      'Invited m.tanaka@logicraft.io as Warehouse Associate','10.14.2.10',  NOW() - INTERVAL '2 days'),
    (1, 3, 'Jules Okafor','Fleet Supervisor',  'user.suspend',     'user',      '5',      'Suspended s.boateng pending compliance review',      '10.14.2.44',  NOW() - INTERVAL '40 days')
) AS a(workspace_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, ip, at)
WHERE NOT EXISTS (
    SELECT 1 FROM audit_logs existing
    WHERE existing.actor_id = a.actor_id AND existing.action = a.action
);

-- ─────────────────────────── shipment milestones ───────────────────────────
-- ShipmentStepper infers reached steps from status and fills the gaps
-- positionally, but it prefers a real timestamp when one is supplied. Without
-- these, every step in the drawer reads "Not reached" regardless of status.
--
-- References and statuses are the three shipments V2 actually seeded
-- (LOG-8841-X in_transit, LOG-9021-Y picked_up, LOG-3310-Z delivered); the
-- chains stop at each shipment's real current status rather than inventing one.
INSERT INTO shipment_milestones (shipment_id, status, at, location, note, seq)
SELECT s.id, m.status, m.at, m.location, m.note, m.seq
FROM (VALUES
    ('LOG-8841-X', 'created',    NOW() - INTERVAL '6 days',   'Central Logistics Hub', NULL::text, 0),
    ('LOG-8841-X', 'picked_up',  NOW() - INTERVAL '5 days',   'Central Logistics Hub', NULL, 1),
    ('LOG-8841-X', 'in_transit', NOW() - INTERVAL '4 days',   'Gary, IN',            NULL, 2),
    ('LOG-9021-Y', 'created',    NOW() - INTERVAL '3 days',   'East Coast Facility',  NULL, 0),
    ('LOG-9021-Y', 'picked_up',  NOW() - INTERVAL '2 days',   'East Coast Facility',  NULL, 1),
    ('LOG-3310-Z', 'created',    NOW() - INTERVAL '9 days',   'West Coast Facility',  NULL, 0),
    ('LOG-3310-Z', 'picked_up',  NOW() - INTERVAL '8 days',   'West Coast Facility',  NULL, 1),
    ('LOG-3310-Z', 'in_transit', NOW() - INTERVAL '7 days',   'Denver, CO',          NULL, 2),
    ('LOG-3310-Z', 'out_for_delivery', NOW() - INTERVAL '1 day',  'Seattle, WA',     NULL, 3),
    ('LOG-3310-Z', 'delivered',  NOW() - INTERVAL '7 hours',  'Seattle, WA',         'Signed by R. Alvarez', 4)
) AS m(reference, status, at, location, note, seq)
JOIN shipments s ON s.reference = m.reference
WHERE NOT EXISTS (
    SELECT 1 FROM shipment_milestones existing
    WHERE existing.shipment_id = s.id AND existing.status = m.status
);

-- ═══════════════════════ backfills ═══════════════════════
-- V2 seeded three vehicles by INSERT and V6 re-inserted the same ids with an
-- ON CONFLICT clause that only updated plate/type/capacity/status. Everything
-- else V6 lists for a vehicle therefore stayed null, so the vehicle drawer
-- rendered em-dashes for make, model, VIN, location and both service dates.
UPDATE vehicles v SET
    vin              = CASE v.id WHEN 1 THEN '1FTFW1ET4DFC10312'
                                  WHEN 2 THEN '1GCWAFPB4M1138274'
                                  WHEN 3 THEN '1XKAD49X14JJ88220' END,
    make             = CASE v.id WHEN 1 THEN 'Freightliner' WHEN 2 THEN 'Chevrolet' ELSE 'Kenworth' END,
    model            = CASE v.id WHEN 1 THEN 'Cascadia 126' WHEN 2 THEN 'Express 3500' ELSE 'K370' END,
    year             = CASE v.id WHEN 1 THEN 2021 WHEN 2 THEN 2020 ELSE 2019 END,
    location_label   = CASE v.id WHEN 1 THEN 'Chicago, IL' WHEN 2 THEN 'Chicago, IL' ELSE 'Gary, IN' END,
    lat              = CASE v.id WHEN 1 THEN 41.8781 WHEN 2 THEN 41.8819 ELSE 41.5934 END,
    lng              = CASE v.id WHEN 1 THEN -87.6298 WHEN 2 THEN -87.6278 ELSE -87.3464 END,
    current_driver_id = CASE v.id WHEN 1 THEN 1 WHEN 2 THEN 2 ELSE NULL END,
    last_service_at  = CASE v.id WHEN 1 THEN NOW() - INTERVAL '62 days'
                                  WHEN 2 THEN NOW() - INTERVAL '41 days'
                                  ELSE NOW() - INTERVAL '96 days' END,
    next_service_at  = CASE v.id WHEN 1 THEN NOW() + INTERVAL '8 days'
                                  WHEN 2 THEN NOW() + INTERVAL '19 days'
                                  ELSE NOW() - INTERVAL '5 days' END
WHERE v.vin IS NULL;

-- Warehouses likewise had no address or coordinates from V2, and used_capacity
-- stayed at the column default of 0. Deriving both figures from the zones
-- seeded above keeps them consistent with the Storage page: total capacity is
-- the sum of the zones, and occupancy is held at 85% rather than always full.
UPDATE warehouses w SET
    address = CASE w.id WHEN 1 THEN '1200 S Canal St, Chicago, IL 60606'
                        WHEN 2 THEN '88 Portside Dr, Newark, NJ 07114'
                        ELSE '4400 Alaskan Way, Seattle, WA 98104' END,
    lat     = CASE w.id WHEN 1 THEN 41.8679 WHEN 2 THEN 40.6895 ELSE 47.6062 END,
    lng     = CASE w.id WHEN 1 THEN -87.6432 WHEN 2 THEN -74.1745 ELSE -122.3321 END
WHERE w.address IS NULL;

UPDATE warehouses w SET
    used_capacity  = COALESCE(z.used_total, 0),
    total_capacity = COALESCE(z.cap_total, 0)
FROM (SELECT warehouse_id,
             SUM(used_capacity)::INTEGER  AS used_total,
             SUM(capacity_units)::INTEGER AS cap_total
        FROM zones GROUP BY warehouse_id) z
WHERE z.warehouse_id = w.id AND w.used_capacity = 0;

-- V5 inserted 50,000 shipments with driver_id, vehicle_id and
-- origin_warehouse_id all null, so the Shipments table and drawer showed
-- "Unassigned" on every row. Driver 1 is on_route, driver 2 is available and
-- driver 3 is off duty, so off-duty work is left unassigned on purpose.
UPDATE shipments s SET
    origin_warehouse_id = ((s.id - 1) % 3) + 1,
    driver_id = CASE s.status
                    WHEN 'in_transit'      THEN 1
                    WHEN 'out_for_delivery' THEN 1
                    WHEN 'picked_up'       THEN 2
                    WHEN 'delivered'       THEN 2
                    ELSE NULL
                END,
    vehicle_id = CASE s.status
                    WHEN 'in_transit'      THEN 1
                    WHEN 'out_for_delivery' THEN 2
                    WHEN 'picked_up'       THEN 2
                    WHEN 'delivered'       THEN 1
                    ELSE NULL
                END
WHERE s.origin_warehouse_id IS NULL;

-- ─────────────────────────── telemetry ───────────────────────────
-- /metrics/series/speed?tripId= has nothing to plot without these, so the
-- Tracking Center speed-history chart stays permanently empty.
INSERT INTO trip_telemetry_samples (trip_id, at, lat, lng, speed_kph, fuel_level, heading_deg)
SELECT t.id,
       NOW() - (make_interval(mins => (s.n * 5))) ,
       t.lat + ((s.n % 5) - 2) * 0.01,
       t.lng + ((s.n % 7) - 3) * 0.01,
       ROUND((55 + ((s.n * 7) % 40))::numeric, 1),
       GREATEST(20, t.fuel_level - (s.n / 3)),
       (s.n * 11) % 360
FROM trips t
CROSS JOIN generate_series(1, 24) AS s(n)
WHERE t.status IN ('active', 'delayed')
  -- (trip_id, at) is genuinely unique, but `at` is derived from NOW() and so
  -- never matches a value written by an earlier run; guard on the window
  -- instead of relying on ON CONFLICT.
  AND NOT EXISTS (
      SELECT 1 FROM trip_telemetry_samples existing
      WHERE existing.trip_id = t.id AND existing.at >= NOW() - INTERVAL '2 hours'
  );
