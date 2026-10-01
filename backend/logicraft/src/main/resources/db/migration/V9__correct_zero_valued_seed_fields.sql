-- V9__correct_zero_valued_seed_fields.sql
-- Corrects a defect in V8.
--
-- V8 backfilled drivers.weekly_hours with
--
--     weekly_hours = COALESCE(d.weekly_hours, GREATEST(18.0, 46.0 - d.id * 6.5))
--
-- but V2 seeded that column as 0.0, not NULL, so COALESCE saw a present value
-- and left it at zero while every other driver field was filled in. The drawer
-- renders it as "0 h", which reads as a driver who has never worked rather than
-- one whose hours were never recorded.
--
-- V8's WHERE clause also only tested IS NULL, so the row never even qualified
-- for update. A zero in a hours-worked column is not a measurement, so the
-- predicate has to treat it as absent.
--
-- This cannot be corrected by editing V8: the checksum is already recorded in
-- flyway_schema_history for the databases that applied it.

UPDATE drivers d SET
    weekly_hours = GREATEST(18.0, 46.0 - d.id * 6.5)
WHERE COALESCE(d.weekly_hours, 0) = 0;

-- The same zero-is-not-a-value reasoning applies to the other numeric columns a
-- dashboard or meter reads. Each guard below is written as "zero means absent"
-- so a future reseed cannot reintroduce an empty meter or a false 0% bar.
UPDATE vehicles v SET
    fuel_level = GREATEST(5, 90 - v.id * 22)
WHERE COALESCE(v.fuel_level, 0) = 0;

UPDATE drivers d SET
    safety_score = GREATEST(70, 96 - d.id * 4)
WHERE COALESCE(d.safety_score, 0) = 0;

-- A rating of zero is not a real score; the column has no lower bound constraint
-- so this is a data-quality guard rather than a schema one.
UPDATE drivers d SET
    rating = GREATEST(3.8, 5.0 - d.id * 0.1)
WHERE COALESCE(d.rating, 0) = 0;

-- A trip covering zero kilometres is a placeholder, not a measurement.
UPDATE trips t SET
    distance_km = ROUND((40 + ((t.id * 137) % 880) + ((t.id * 7) % 90) * 0.5)::NUMERIC, 1)
WHERE COALESCE(t.distance_km, 0) = 0;

-- An odometer at exactly zero means the vehicle has never been driven, which
-- contradicts having an acquisition date and a service history.
UPDATE vehicles v SET
    odometer_km = ROUND((120000 + v.id * 48770.5)::NUMERIC, 1)
WHERE COALESCE(v.odometer_km, 0) = 0;