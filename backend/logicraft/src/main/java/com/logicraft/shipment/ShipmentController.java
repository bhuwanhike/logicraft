package com.logicraft.shipment;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Shipment list endpoint.
 *
 * Reads through JdbcTemplate rather than the JPA entity because the workspace
 * UI needs three things a Shipment row does not carry: the driver's name, the
 * vehicle's plate, and the milestone timeline that ShipmentStepper renders.
 * Those are joins and a child collection, and resolving them per row would be
 * an N+1 across a 200-row page.
 */
@RestController
@RequestMapping("/shipments")
public class ShipmentController {

    private static final int DEFAULT_SIZE = 200;
    private static final int MAX_SIZE = 1000;

    private static final String BASE = """
        SELECT s.id, s.reference, s.origin, s.destination, s.mode, s.status,
               s.weight_kg   AS "weightKg",
               s.eta,
               s.created_at  AS "createdAt",
               COALESCE(d.name, 'Unassigned') AS "driverName",
               -- Vehicle assignment follows the same convention as the driver
               -- column. A shipment that has not been picked up, or that was
               -- cancelled or hit an exception, has no vehicle, and a null here
               -- renders as an empty cell rather than saying so.
               COALESCE(v.plate, 'Not assigned') AS "vehiclePlate"
          FROM shipments s
          LEFT JOIN drivers  d ON d.id = s.driver_id
          LEFT JOIN vehicles v ON v.id = s.vehicle_id
        """;

    private final JdbcTemplate jdbcTemplate;

    public ShipmentController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public ResponseEntity<?> getShipments(
        @RequestParam(defaultValue = "1") Long workspaceId,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String mode,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String unassigned,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "200") int size
    ) {
        try {
            StringBuilder where = new StringBuilder(" WHERE s.workspace_id = ?");
            List<Object> args = new ArrayList<>();
            args.add(workspaceId);
            applyFilters(where, args, status, mode, q, unassigned);

            int limit = Math.max(1, Math.min(size <= 0 ? DEFAULT_SIZE : size, MAX_SIZE));
            int offset = Math.max(0, page) * limit;

            // LIMIT/OFFSET come last in the statement, so they append to the
            // bound filter arguments rather than preceding them.
            List<Object> params = new ArrayList<>(args);
            params.add(limit);
            params.add(offset);

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                BASE + where + " ORDER BY s.id DESC LIMIT ? OFFSET ?",
                params.toArray());

            List<ShipmentDTO> dtos = new ArrayList<>(rows.size());
            for (Map<String, Object> row : rows) {
                ShipmentDTO dto = new ShipmentDTO();
                dto.setId(asLong(row.get("id")));
                dto.setReference(asString(row.get("reference")));
                dto.setOrigin(asString(row.get("origin")));
                dto.setDestination(asString(row.get("destination")));
                dto.setMode(asString(row.get("mode")));
                dto.setStatus(asString(row.get("status")));
                dto.setDriverName(asString(row.get("driverName")));
                dto.setVehiclePlate(asString(row.get("vehiclePlate")));
                dto.setWeightKg(row.get("weightKg") instanceof java.math.BigDecimal bd ? bd : null);
                dto.setEta(asOffsetDateTime(row.get("eta")));
                dto.setCreatedAt(asOffsetDateTime(row.get("createdAt")));
                dtos.add(dto);
            }

            attachMilestones(dtos);

            return ResponseEntity.ok(dtos);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /**
     * Total shipments matching the same filters as {@link #getShipments}, for
     * the pagination control. Kept in step with the list endpoint deliberately:
     * the filter block is shared rather than duplicated so the two cannot drift.
     */
    @GetMapping("/count")
    public ResponseEntity<?> countShipments(
        @RequestParam(defaultValue = "1") Long workspaceId,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String mode,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String unassigned
    ) {
        try {
            StringBuilder where = new StringBuilder(" WHERE s.workspace_id = ?");
            List<Object> args = new ArrayList<>();
            args.add(workspaceId);
            applyFilters(where, args, status, mode, q, unassigned);

            Long count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM shipments s"
                    + " LEFT JOIN drivers  d ON d.id = s.driver_id"
                    + " LEFT JOIN vehicles v ON v.id = s.vehicle_id"
                    + where,
                Long.class,
                args.toArray());
            return ResponseEntity.ok(Map.of("count", count == null ? 0L : count));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /**
     * Loads milestones for every row on the page in a single query.
     *
     * Filtering by IN (...) rather than calling per row keeps this at two
     * round trips per page instead of one plus the page size, which matters
     * because the default page is 200 shipments.
     */
    private void attachMilestones(List<ShipmentDTO> dtos) {
        if (dtos.isEmpty()) {
            return;
        }
        List<Long> ids = new ArrayList<>(dtos.size());
        for (ShipmentDTO dto : dtos) {
            ids.add(dto.getId());
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT shipment_id, status, at, at AS timestamp, location, note"
                + "  FROM shipment_milestones"
                + " WHERE shipment_id IN (" + placeholders(ids.size()) + ")"
                + " ORDER BY shipment_id, seq, at",
            ids.toArray());

        Map<Long, List<Map<String, Object>>> grouped = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> milestone = new LinkedHashMap<>();
            // Stepper.tsx reads `at` with `timestamp` as its fallback; both are
            // supplied so either spelling resolves.
            milestone.put("status", row.get("status"));
            milestone.put("at", row.get("at"));
            milestone.put("timestamp", row.get("timestamp"));
            milestone.put("location", row.get("location"));
            milestone.put("note", row.get("note"));
            grouped
                .computeIfAbsent(asLong(row.get("shipment_id")), k -> new ArrayList<>())
                .add(milestone);
        }

        for (ShipmentDTO dto : dtos) {
            dto.setMilestones(grouped.getOrDefault(dto.getId(), List.of()));
        }
    }

    private static String placeholders(int count) {
        return String.join(",", java.util.Collections.nCopies(count, "?"));
    }

    /**
     * Appends the filter predicates shared by the list and count endpoints.
     *
     * The q predicate references d.name and v.plate, so the calling FROM clause
     * must carry both LEFT JOINs even when the other filters are all no-ops.
     */
    private static void applyFilters(
        StringBuilder where, List<Object> args,
        String status, String mode, String q, String unassigned
    ) {
        // services/api.ts drops 'all' rather than sending it, but a tab id
        // of "all" is a legitimate no-op filter if it ever arrives.
        if (isSet(status)) {
            where.append(" AND s.status = ?");
            args.add(status.trim().toLowerCase(Locale.ROOT));
        }
        // ShipmentsPage MODE_FILTERS: road | air | sea.
        if (isSet(mode)) {
            where.append(" AND s.mode = ?");
            args.add(mode.trim().toLowerCase(Locale.ROOT));
        }
        // The assignment modal in DriversPage lists what is unclaimed.
        if (isSet(unassigned) && Boolean.parseBoolean(unassigned.trim())) {
            where.append(" AND s.driver_id IS NULL");
        }
        if (isSet(q)) {
            // "Search by reference, route, or driver"
            String term = "%" + q.trim().toLowerCase() + "%";
            where.append(
                " AND (lower(s.reference) LIKE ? OR lower(s.origin) LIKE ?"
                    + " OR lower(s.destination) LIKE ? OR lower(d.name) LIKE ?"
                    + " OR lower(v.plate) LIKE ?)");
            args.add(term);
            args.add(term);
            args.add(term);
            args.add(term);
            args.add(term);
        }
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank() && !"all".equalsIgnoreCase(value.trim());
    }

    private static Long asLong(Object value) {
        return value instanceof Number n ? n.longValue() : null;
    }

    /**
     * Normalises a timestamptz column to an OffsetDateTime.
     *
     * JdbcTemplate does not promise a particular temporal type for
     * timestamptz, and the PostgreSQL driver in this project hands back a
     * java.sql.Timestamp rather than an OffsetDateTime. A naive
     * `instanceof OffsetDateTime` check therefore evaluates false for a column
     * that is very much present, and the field serialises as null while the
     * database holds a value. Every plausible return type is handled instead.
     */
    private static OffsetDateTime asOffsetDateTime(Object value) {
        if (value instanceof OffsetDateTime) {
            return (OffsetDateTime) value;
        }
        if (value instanceof Timestamp) {
            return ((Timestamp) value).toInstant().atOffset(ZoneOffset.UTC);
        }
        if (value instanceof Instant) {
            return ((Instant) value).atOffset(ZoneOffset.UTC);
        }
        if (value instanceof LocalDateTime) {
            return ((LocalDateTime) value).atZone(ZoneId.systemDefault()).toOffsetDateTime();
        }
        return null;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
