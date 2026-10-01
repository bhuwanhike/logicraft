package com.logicraft.common;

import java.sql.Array;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read endpoints for the resources that have no domain module of their own.
 *
 * Two rules shaped this class, and both come from the same place: the keys the
 * workspace UI reads off a row. See components/workspace/*.tsx.
 *
 * 1. Every column is aliased to the exact key the UI reads. A previous
 *    `SELECT *` returned Postgres column labels (odometer_km, last_service_at,
 *    current_driver_id) while the UI reads odometerKm, lastServiceAt,
 *    currentDriverName. Nothing throws on a missing key, so every such field
 *    simply rendered an em-dash and the page looked half-populated.
 *
 * 2. Anything the UI derives is computed here rather than left to the client.
 *    currentDriverName and documentCount are joins and a correlated count; the
 *    UI has no way to produce them from an id.
 *
 * The `sanitize` step is not cosmetic. A TEXT[] column arrives as a
 * org.postgresql.jdbc.PgArray and a jsonb column as a PGobject, neither of
 * which Jackson renders usefully -- String() on the result is what puts
 * "[object Object]" into table cells. Both are unwrapped to plain Java here.
 */
@RestController
@RequestMapping("/")
public class GenericController {

    private final JdbcTemplate jdbcTemplate;

    /**
     * The UI paginates client-side (SortableTable slices the array it was
     * given), so it never sends page/size. A 50-row default left the shipment
     * table paging through a 50,000-row table five rows deep at a time.
     */
    private static final int DEFAULT_SIZE = 200;
    private static final int MAX_SIZE = 1000;

    public GenericController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // ─────────────────────────── projections ───────────────────────────
    // Keyed by the path segment in services/api.ts. Aliases are quoted so
    // Postgres preserves the camelCase rather than folding it to lowercase.

    private static final Map<String, String> LIST_SQL = Map.ofEntries(
        Map.entry("vehicles", """
            SELECT v.id, v.plate, v.type, v.status, v.vin, v.make, v.model, v.year,
                   v.capacity_kg   AS "capacityKg",
                   v.fuel_level    AS "fuelLevel",
                   v.odometer_km   AS "odometerKm",
                   v.last_service_at AS "lastServiceAt",
                   v.next_service_at AS "nextServiceAt",
                   v.location_label   AS "locationLabel",
                   v.lat, v.lng,
                   v.created_at    AS "createdAt",
                   d.name          AS "currentDriverName",
                   (SELECT COUNT(*) FROM vehicle_documents vd
                     WHERE vd.vehicle_id = v.id) AS "documentCount"
              FROM vehicles v
              LEFT JOIN drivers d ON d.id = v.current_driver_id
            """),
        Map.entry("drivers", """
            SELECT d.id, d.name, d.email, d.phone, d.status,
                   d.license_number AS "licenseNumber",
                   d.license_expiry AS "licenseExpiry",
                   d.safety_score   AS "safetyScore",
                   d.rating,
                   d.trips_completed AS "tripsCompleted",
                   d.weekly_hours    AS "weeklyHours",
                   d.certifications,
                   d.joined_at AS "joinedAt"
              FROM drivers d
            """),
        Map.entry("warehouses", """
            SELECT w.id, w.name, w.status, w.address, w.lat, w.lng,
                   w.used_capacity  AS "usedCapacity",
                   w.total_capacity AS "totalCapacity",
                   w.created_at     AS "createdAt"
              FROM warehouses w
            """),
        Map.entry("zones", """
            SELECT z.id, z.code, z.name, z.description, z.status,
                   z.warehouse_id     AS "warehouseId",
                   z.capacity_units   AS "capacityUnits",
                   z.used_capacity    AS "usedCapacity",
                   z.dock_doors       AS "dockDoors",
                   z.temperature_controlled AS "temperatureControlled"
              FROM zones z
              JOIN warehouses w ON w.id = z.warehouse_id
            """),
        Map.entry("inventory", """
            SELECT i.id, i.sku, i.name, i.unit,
                   i.warehouse_id     AS "warehouseId",
                   i.quantity,
                   i.reserved_quantity AS "reservedQuantity",
                   i.reorder_point     AS "reorderPoint",
                   i.reorder_quantity  AS "reorderQuantity",
                   i.bin_location      AS "binLocation",
                   i.weight_kg         AS "weightKg",
                   i.last_movement_at  AS "lastMovementAt",
                   COALESCE(z.code, 'unassigned') AS zone
              FROM inventory_items i
              LEFT JOIN zones z ON z.id = i.zone_id
              JOIN warehouses w ON w.id = i.warehouse_id
            """),
        // Reached only via GET /inventory?movements=true — the same endpoint
        // the UI uses for two different tables (WarehousesPage MovementsPanel).
        Map.entry("stock-movements", """
            SELECT m.id, m.kind, m.delta,
                   m.balance_after AS "balanceAfter",
                   m.description, m.reference,
                   i.sku,
                   m.occurred_at AS at,
                   m.occurred_at AS "createdAt"
              FROM stock_movements m
              JOIN inventory_items i ON i.id = m.item_id
              JOIN warehouses w ON w.id = m.warehouse_id
            """),
        Map.entry("trips", """
            SELECT t.id, t.reference, t.plate, t.status, t.origin, t.destination,
                   t.lat, t.lng, t.eta,
                   t.speed_kph    AS "speedKph",
                   t.fuel_level   AS "fuelLevel",
                   t.heading_deg  AS "headingDeg",
                   t.distance_km  AS "distanceKm",
                   t.last_reported_at AS "lastReportedAt",
                   COALESCE(d.name, 'Unassigned') AS "driverName",
                   COALESCE(v.plate, t.plate)    AS "vehiclePlate"
              FROM trips t
              LEFT JOIN drivers  d ON d.id = t.driver_id
              LEFT JOIN vehicles v ON v.id = t.vehicle_id
            """),
        Map.entry("notifications", """
            SELECT n.id, n.level, n.title,
                   n.body        AS message,
                   n.body        AS detail,
                   n.entity_type AS "entityType",
                   n.entity_id   AS "entityId",
                   n.reference,
                   n.is_read     AS "read",
                   n.read_at     AS "readAt",
                   n.raised_at   AS at,
                   n.raised_at   AS "createdAt"
              FROM notifications n
            """),
        Map.entry("audit-logs", """
            SELECT a.id, a.at, a.at AS "createdAt",
                   a.actor_name AS "actorName",
                   a.actor_role AS "actorRole",
                   a.action,
                   a.entity_type AS "entityType",
                   a.entity_id   AS "entityId",
                   a.summary, a.ip,
                   -- audit_logs is append-only, so a null user_agent cannot be
                   -- corrected after the fact by any migration or admin query.
                   -- The six rows V7 inserted predate this and have none, so the
                   -- projection substitutes a label rather than leaving the
                   -- column blank in the settings table.
                   COALESCE(a.user_agent, 'Recorded by service') AS "userAgent"
              FROM audit_logs a
            """),
        Map.entry("users", """
            SELECT u.id, u.name, u.username, u.email, u.company,
                   COALESCE(r.display_name, u.username) AS role,
                   u.status,
                   u.is_active,
                   u.last_active_at AS "lastActiveAt",
                   u.created_at     AS "createdAt"
              FROM users u
              LEFT JOIN LATERAL (
                    SELECT ro.display_name
                      FROM user_roles ur
                      JOIN roles ro ON ro.id = ur.role_id
                     WHERE ur.user_id = u.id
                     ORDER BY ro.rank
                     LIMIT 1
              ) r ON TRUE
            """));

    /** Tables counted by GET /{resource}/count. */
    private static final Map<String, String> COUNT_TABLE = Map.ofEntries(
        Map.entry("vehicles", "vehicles"),
        Map.entry("drivers", "drivers"),
        Map.entry("warehouses", "warehouses"),
        Map.entry("zones", "zones"),
        Map.entry("inventory", "inventory_items"),
        Map.entry("trips", "trips"),
        Map.entry("notifications", "notifications"),
        Map.entry("audit-logs", "audit_logs"),
        Map.entry("users", "users"));

    // ─────────────────────────── requests ───────────────────────────

    @GetMapping("/{resource}")
    public ResponseEntity<?> getResource(
        @PathVariable String resource,
        @RequestParam(defaultValue = "1") Long workspaceId,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String level,
        @RequestParam(required = false) String read,
        @RequestParam(required = false) String movements,
        @RequestParam(required = false) Long warehouseId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "200") int size
    ) {
        // Movements are a different table reached through the same path, so the
        // branch has to happen before the projection is looked up.
        String key = isTruthy(movements) ? "stock-movements" : resource;
        String projection = LIST_SQL.get(key);
        if (projection == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Unknown resource: " + resource));
        }

        try {
            Where where = new Where();
            applyScope(key, workspaceId, warehouseId, where);
            applyFilters(key, q, status, type, level, read, where);

            int limit = Math.max(1, Math.min(size <= 0 ? DEFAULT_SIZE : size, MAX_SIZE));
            int offset = Math.max(0, page) * limit;

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                projection + where.clause() + " ORDER BY 1 LIMIT ? OFFSET ?",
                concat(where.args(), limit, offset));

            return ResponseEntity.ok(sanitize(rows));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @GetMapping("/{resource}/count")
    public ResponseEntity<?> countResource(@PathVariable String resource) {
        String table = COUNT_TABLE.get(resource);
        if (table == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Unknown resource: " + resource));
        }
        try {
            Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
            return ResponseEntity.ok(Map.of("count", count == null ? 0L : count));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    // ─────────────────────────── filtering ───────────────────────────

    /**
     * Restricts a resource to one workspace.
     *
     * The child tables (zones, inventory_items, stock_movements) have no
     * workspace_id of their own — they hang off warehouses — so those scope
     * through the join that is already in the projection.
     */
    private void applyScope(String key, Long workspaceId, Long warehouseId, Where w) {
        if (warehouseId != null) {
            switch (key) {
                case "zones", "inventory", "stock-movements" -> w.add("w.id = ?", warehouseId);
                case "shipments" -> w.add("origin_warehouse_id = ?", warehouseId);
                default -> w.add("warehouse_id = ?", warehouseId);
            }
        }
        switch (key) {
            case "zones", "inventory", "stock-movements" -> w.add("w.workspace_id = ?", workspaceId);
            case "audit-logs" -> w.add("a.workspace_id = ?", workspaceId);
            case "users" -> w.add("(u.workspace_id IS NULL OR u.workspace_id = ?)", workspaceId);
            default -> w.add(base(key) + ".workspace_id = ?", workspaceId);
        }
    }

    private void applyFilters(
        String key,
        String q,
        String status,
        String type,
        String level,
        String read,
        Where w
    ) {
        if (q != null && !q.isBlank()) {
            String term = "%" + q.trim().toLowerCase() + "%";
            switch (key) {
                // "Search by plate, VIN, or make"
                case "vehicles" -> w.add(
                    "(lower(v.plate) LIKE ? OR lower(v.vin) LIKE ? OR lower(v.make) LIKE ?)", term, term, term);
                // "Search by name, licence, or email"
                case "drivers" -> w.add(
                    "(lower(d.name) LIKE ? OR lower(d.license_number) LIKE ? OR lower(d.email) LIKE ?)",
                    term, term, term);
                case "trips" -> w.add(
                    "(lower(t.reference) LIKE ? OR lower(t.plate) LIKE ?"
                        + " OR lower(t.origin) LIKE ? OR lower(t.destination) LIKE ?)",
                    term, term, term, term);
                case "inventory" -> w.add("(lower(i.sku) LIKE ? OR lower(i.name) LIKE ?)", term, term);
                case "notifications" -> w.add("(lower(n.title) LIKE ? OR lower(n.body) LIKE ?)", term, term);
                case "warehouses", "zones" -> w.add("lower(" + base(key) + ".name) LIKE ?", term);
                default -> w.add("lower(" + base(key) + ".title) LIKE ?", term);
            }
        }

        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            w.add(base(key) + ".status = ?", status.trim().toLowerCase(Locale.ROOT));
        }

        // VehiclesPage TYPE_FILTERS.
        if (type != null && !type.isBlank() && !"all".equalsIgnoreCase(type)) {
            w.add("v.type = ?", type.trim().toLowerCase(Locale.ROOT));
        }

        // DashboardPage sends level=critical,warning — a comma list, not a
        // repeated parameter, because services/api.ts joins arrays itself.
        if (level != null && !level.isBlank()) {
            List<String> levels = Arrays.stream(level.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
            if (!levels.isEmpty()) {
                w.addIn("n.level", levels);
            }
        }

        // The UI compares `read === false`, so an absent or non-boolean value
        // must not be treated as false.
        if (read != null && !read.isBlank()) {
            w.add("n.is_read = ?", Boolean.parseBoolean(read.trim()));
        }
    }

    /** Leading alias for a resource, used to build the WHERE clauses. */
    private static String base(String key) {
        return switch (key) {
            case "vehicles" -> "v";
            case "drivers" -> "d";
            case "warehouses" -> "w";
            case "zones" -> "z";
            case "inventory" -> "i";
            case "stock-movements" -> "m";
            case "trips" -> "t";
            case "notifications" -> "n";
            case "audit-logs" -> "a";
            case "users" -> "u";
            default -> "x";
        };
    }

    // ─────────────────────────── plumbing ───────────────────────────

    /**
     * Turns driver-side values into something Jackson can render.
     *
     * A TEXT[] column arrives as PgArray and a jsonb column as PGobject. Left
     * alone Jackson serialises both as beans, and the UI's cell formatter calls
     * String() on them — which is exactly how "[object Object]" reached the
     * table. Unwrapping here keeps the object off the wire entirely.
     */
    private static List<Map<String, Object>> sanitize(List<Map<String, Object>> rows) {
        List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            Map<String, Object> clean = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : row.entrySet()) {
                clean.put(entry.getKey(), unwrap(entry.getValue()));
            }
            out.add(clean);
        }
        return out;
    }

    private static Object unwrap(Object value) {
        if (value instanceof Array array) {
            try {
                Object inner = array.getArray();
                return inner == null ? List.of() : inner;
            } catch (Exception e) {
                return List.of();
            }
        }
        return unwrapVendorObject(value);
    }

    /**
     * Unwraps a driver value that Jackson would otherwise render as a bean.
     *
     * A jsonb column arrives as org.postgresql.util.PGobject. The PostgreSQL
     * driver is a runtime dependency, so that class cannot be named here without
     * widening the POM's scope — hence matching on the class name and calling
     * getValue reflectively. No projection below selects a jsonb column today;
     * this exists so that adding one later does not silently reintroduce
     * "[object Object]" into a table cell.
     */
    private static Object unwrapVendorObject(Object value) {
        if (value == null || !"org.postgresql.util.PGobject".equals(value.getClass().getName())) {
            return value;
        }
        try {
            return value.getClass().getMethod("getValue").invoke(value);
        } catch (ReflectiveOperationException e) {
            return null;
        }
    }

    private static boolean isTruthy(String flag) {
        return flag != null && (flag.equalsIgnoreCase("true") || flag.equals("1"));
    }

    private static Object[] concat(List<Object> args, Object... extra) {
        List<Object> all = new ArrayList<>(args);
        all.addAll(Arrays.asList(extra));
        return all.toArray();
    }

    /** Accumulates WHERE fragments and their bound arguments in order. */
    private static final class Where {
        private final StringBuilder sql = new StringBuilder();
        private final List<Object> args = new ArrayList<>();

        void add(String fragment, Object... values) {
            sql.append(sql.isEmpty() ? " WHERE " : " AND ").append(fragment);
            args.addAll(Arrays.asList(values));
        }

        void addIn(String column, List<String> values) {
            String holes = values.stream().map(v -> "?").collect(Collectors.joining(", "));
            add(column + " IN (" + holes + ")", values.toArray());
        }

        String clause() {
            return sql.toString();
        }

        List<Object> args() {
            return args;
        }
    }
}
