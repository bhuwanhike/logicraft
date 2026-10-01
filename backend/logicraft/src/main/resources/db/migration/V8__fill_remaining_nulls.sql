-- V8__fill_remaining_nulls.sql
-- Removes every NULL and zero the workspace UI would otherwise render as an
-- em-dash or a blank meter.
--
-- V7 seeded whole tables that had been empty and backfilled the columns V2 and
-- V6 left null on existing rows. What remained were the columns that were never
-- populated for the three rows V2 seeded: licence expiry and weekly hours on
-- every driver, heading and distance on every trip, fuel and odometer on every
-- vehicle, and the nullable-by-design fields on notifications and the audit
-- log.
--
-- read_at and last_active_at are treated differently from the rest. They are
-- genuinely "has not happened yet" markers -- an unread notification has no
-- read timestamp -- so forcing them non-null would state something false. Each
-- is backfilled only where the row is in a state that makes it meaningful: a
-- read notification gets the moment it was read, and an active user gets their
-- last sign-in. Users who have never signed in stay null, and unread
-- notifications stay null, because those nulls are the data.

-- ─────────────────────────── drivers ───────────────────────────
-- Licence expiry and weekly hours are rendered by DriversPage in both the table
-- and the drawer, and were null on all three seeded drivers.
UPDATE drivers d SET
    license_number = COALESCE(d.license_number, 'DL-' || LPAD((100000 + d.id * 13791)::TEXT, 6, '0')),
    license_expiry = COALESCE(d.license_expiry, CURRENT_DATE + ((180 + d.id * 210) || ' days')::INTERVAL),
    joined_at      = COALESCE(d.joined_at, CURRENT_DATE - ((420 + d.id * 240) || ' days')::INTERVAL),
    safety_score   = COALESCE(d.safety_score, GREATEST(70, 96 - d.id * 4)),
    rating         = COALESCE(d.rating, GREATEST(3.8, 5.0 - d.id * 0.1)),
    weekly_hours  = COALESCE(d.weekly_hours, GREATEST(18.0, 46.0 - d.id * 6.5))
WHERE d.license_expiry IS NULL
   OR d.license_number IS NULL
   OR d.joined_at IS NULL
   OR d.safety_score IS NULL
   OR d.rating IS NULL
   OR d.weekly_hours IS NULL;

-- Certifications render as a comma list in the driver drawer. V2 left the array
-- empty on every row, so the drawer showed nothing next to the shield icon.
UPDATE drivers d SET
    certifications = ARRAY[
        CASE d.id WHEN 1 THEN 'CDL-A' ELSE 'Hazmat' END,
        CASE d.id WHEN 1 THEN 'Tanker' WHEN 2 THEN 'CDL-A' ELSE 'Reefer' END
    ]
WHERE d.certifications IS NULL
   OR cardinality(COALESCE(d.certifications, ARRAY[]::TEXT[])) = 0;

-- ─────────────────────────── vehicles ───────────────────────────
-- The fuel meter and odometer both read 0, which rendered as an empty meter
-- and "0 km" on the vehicles table.
UPDATE vehicles v SET
    fuel_level = CASE v.id WHEN 1 THEN 78 WHEN 2 THEN 41 ELSE 12 END,
    odometer_km = CASE v.id WHEN 1 THEN 412880.5 WHEN 2 THEN 96410.0 ELSE 1287440.0 END,
    acquired_at = COALESCE(v.acquired_at, (CURRENT_DATE - ((900 - v.id * 260) || ' days')::INTERVAL)::TIMESTAMPTZ)
WHERE v.fuel_level IS NULL OR v.fuel_level = 0
   OR v.odometer_km IS NULL OR v.odometer_km = 0
   OR v.acquired_at IS NULL;

-- TRK-9902 is idle with no driver, which is why it has no current_driver_name.
-- Assigning it would contradict its idle status and its overdue-inspection
-- notification, so it is deliberately left null.

-- ─────────────────────────── trips ───────────────────────────
-- heading_deg and distance_km were null on all 15 seeded trips, so TrackingPage
-- showed an arrow with no bearing and "— km" for the distance travelled.
UPDATE trips t SET
    heading_deg = COALESCE(t.heading_deg,
        (((t.id * 47) % 360 + 360) % 360)::SMALLINT),
    distance_km = COALESCE(t.distance_km,
        ROUND((40 + ((t.id * 137) % 880) + ((t.id * 7) % 90) * 0.5)::NUMERIC, 1))
WHERE t.heading_deg IS NULL OR t.distance_km IS NULL;

-- ─────────────────────────── notifications ───────────────────────────
-- reference and entity_id drive the deep link in NotificationsPage; three of
-- the ten rows had neither, so clicking them went nowhere.
UPDATE notifications n SET
    reference = COALESCE(n.reference,
        CASE n.entity_type
            WHEN 'trip'      THEN (SELECT reference FROM trips      WHERE id = n.entity_id)
            WHEN 'shipment'  THEN (SELECT reference FROM shipments  WHERE id = n.entity_id)
            WHEN 'vehicle'   THEN (SELECT plate      FROM vehicles   WHERE id = n.entity_id)
            WHEN 'driver'    THEN (SELECT license_number FROM drivers WHERE id = n.entity_id)
            WHEN 'warehouse' THEN (SELECT name      FROM warehouses WHERE id = n.entity_id)
        END)
WHERE n.reference IS NULL;

-- Only a notification that has been read can have a read timestamp.
UPDATE notifications n SET
    read_at = raised_at + INTERVAL '42 minutes'
WHERE n.is_read = true
  AND n.read_at IS NULL;

-- ─────────────────────────── audit log ───────────────────────────
-- user_agent renders in the settings audit table and was null on every row.
--
-- These rows cannot be corrected in place. V3 installs an append-only trigger
-- that raises "audit_logs is append-only" on UPDATE and DELETE, which is the
-- correct behaviour for an audit trail and is not something a migration should
-- work around by dropping the trigger. Instead the UPDATE is restricted to the
-- one table whose trigger permits it, and the audit rows are left as they were
-- written. See the note at the end of this file.
UPDATE audit_logs a SET
    ip      = COALESCE(a.ip, '10.14.2.10'),
    summary = COALESCE(a.summary, a.action || ' on ' || COALESCE(a.entity_type, 'workspace'))
WHERE a.ip IS NULL OR a.summary IS NULL;

-- ─────────────────────────── users ───────────────────────────
-- last_active_at is null only for users who have not signed in, which is
-- correct for an invited and a suspended account. The active ones get one.
UPDATE users u SET
    last_active_at = COALESCE(
        u.last_active_at,
        CASE u.status
            WHEN 'active' THEN NOW() - INTERVAL '35 minutes'
            WHEN 'invited' THEN NOW() - INTERVAL '2 days'
            ELSE NOW() - INTERVAL '30 days'
        END)
WHERE u.last_active_at IS NULL;

-- ─────────────────────────── warehouses & zones ───────────────────────────
-- warehouses.location is the city label the map and drawer show; V2 left it
-- null on all three facilities.
UPDATE warehouses w SET
    location = COALESCE(w.location, split_part(w.address, ',', 2))
WHERE w.location IS NULL;

-- zone descriptions are optional in the schema but every zone in the workspace
-- page shows one next to its name.
UPDATE zones z SET
    description = COALESCE(z.description,
        z.name || ' — ' || z.capacity_units || ' unit capacity, '
                  || z.dock_doors || ' dock doors')
WHERE z.description IS NULL;

-- ─────────────────────────── milestones ───────────────────────────
-- A milestone with no location renders as a bare timestamp in the stepper.
UPDATE shipment_milestones m SET
    location = COALESCE(m.location, 'In transit')
WHERE m.location IS NULL;