package com.logicraft.common;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reporting endpoints behind the dashboard KPI row and the Analytics page.
 *
 * Two shapes are served here and they are not interchangeable. /summary is a
 * single object because KpiRow reads named fields off it. /series/{key} is a
 * list because TrendChart maps over it. The client distinguishes them by
 * which hook it uses, so returning a bare array from /summary would leave every
 * KPI tile blank with no error anywhere.
 */
@RestController
@RequestMapping("/metrics")
public class MetricsController {

    private final JdbcTemplate jdbcTemplate;

    public MetricsController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Dashboard KPI row.
     *
     * `*Delta` is the current window against the immediately preceding window
     * of the same length, which is what makes "up is good" versus "down is
     * good" meaningful per card.
     */
    @GetMapping("/summary")
    public ResponseEntity<?> getSummary(
        @RequestParam(defaultValue = "7d") String range,
        @RequestParam(defaultValue = "1") Long workspaceId
    ) {
        try {
            int days = rangeDays(range);
            Map<String, Object> out = new LinkedHashMap<>();

            out.put("onTimeRate", rate(
                "SELECT count(*) FILTER (WHERE eta IS NOT NULL AND eta >= created_at) AS good,"
                    + " count(*) AS total FROM shipments"
                    + " WHERE workspace_id = ? AND status = 'delivered' AND created_at >= now() - (? || ' days')::interval",
                workspaceId, days));
            out.put("activeVehicles", count(
                "SELECT count(*) FROM vehicles WHERE workspace_id = ? AND status = 'active'",
                workspaceId));
            out.put("openExceptions", count(
                "SELECT count(*) FROM notifications"
                    + " WHERE workspace_id = ? AND NOT is_read AND level IN ('critical','warning')",
                workspaceId));
            out.put("avgTransitHours", scalar(
                "SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (eta - created_at)) / 3600.0)::numeric, 1), 0)"
                    + " FROM shipments"
                    + " WHERE workspace_id = ? AND status = 'delivered' AND created_at >= now() - (? || ' days')::interval",
                workspaceId, days));

            out.put("onTimeRateDelta", delta(out.get("onTimeRate"), rate(
                "SELECT count(*) FILTER (WHERE eta IS NOT NULL AND eta >= created_at) AS good,"
                    + " count(*) AS total FROM shipments"
                    + " WHERE workspace_id = ? AND status = 'delivered'"
                    + " AND created_at >= now() - (? || ' days')::interval"
                    + " AND created_at < now() - (? || ' days')::interval",
                workspaceId, days * 2, days)));
            out.put("avgTransitHoursDelta", delta(out.get("avgTransitHours"), scalar(
                "SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (eta - created_at)) / 3600.0)::numeric, 1), 0)"
                    + " FROM shipments"
                    + " WHERE workspace_id = ? AND status = 'delivered'"
                    + " AND created_at >= now() - (? || ' days')::interval"
                    + " AND created_at < now() - (? || ' days')::interval",
                workspaceId, days * 2, days)));

            // Active vehicles and open exceptions are current-state gauges, not
            // flows: there is no meaningful "previous window" to compare them
            // against, so no delta is reported rather than a fabricated zero.
            out.put("activeVehiclesDelta", null);
            out.put("openExceptionsDelta", null);

            return ResponseEntity.ok(out);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @GetMapping("/series/{key}")
    public ResponseEntity<?> getSeries(
        @PathVariable String key,
        @RequestParam(defaultValue = "30d") String range,
        @RequestParam(required = false) Long facility,
        @RequestParam(required = false) String tripId,
        @RequestParam(defaultValue = "1") Long workspaceId
    ) {
        try {
            int days = rangeDays(range);
            return ResponseEntity.ok(switch (key) {
                case "throughput" -> throughput(workspaceId, facility, days);
                case "onTime" -> onTime(workspaceId, facility, days);
                case "modeMix" -> modeMix(workspaceId, facility, days);
                case "speed" -> speed(tripId);
                default -> List.of();
            });
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    // ─────────────────────────── series ───────────────────────────

    /** Stacked bars: delivered against exception, one row per day. */
    private List<Map<String, Object>> throughput(Long workspaceId, Long facility, int days) {
        StringBuilder sql = new StringBuilder("""
            SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS period,
                   count(*) FILTER (WHERE status = 'delivered')  AS delivered,
                   count(*) FILTER (WHERE status = 'exception')  AS exception
              FROM shipments
             WHERE workspace_id = ? AND created_at >= now() - (? || ' days')::interval
            """);
        List<Object> args = new ArrayList<>(Arrays.asList(workspaceId, days));
        if (facility != null) {
            sql.append(" AND origin_warehouse_id = ?");
            args.add(facility);
        }
        sql.append(" GROUP BY date_trunc('day', created_at) ORDER BY date_trunc('day', created_at)");
        return jdbcTemplate.queryForList(sql.toString(), args.toArray());
    }

    /** Line chart: share of delivered shipments that met the ETA. */
    private List<Map<String, Object>> onTime(Long workspaceId, Long facility, int days) {
        StringBuilder sql = new StringBuilder("""
            SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS period,
                   CASE WHEN count(*) = 0 THEN 0
                        ELSE ROUND(
                             (count(*) FILTER (WHERE eta IS NOT NULL AND eta >= created_at))::numeric
                             * 100 / count(*), 1)
                   END AS "onTimeRate"
              FROM shipments
             WHERE workspace_id = ? AND status = 'delivered'
               AND created_at >= now() - (? || ' days')::interval
            """);
        List<Object> args = new ArrayList<>(Arrays.asList(workspaceId, days));
        if (facility != null) {
            sql.append(" AND origin_warehouse_id = ?");
            args.add(facility);
        }
        sql.append(" GROUP BY date_trunc('day', created_at) ORDER BY date_trunc('day', created_at)");
        return jdbcTemplate.queryForList(sql.toString(), args.toArray());
    }

    /** Pie chart: TrendChart reads xKey="name" and series key "value". */
    private List<Map<String, Object>> modeMix(Long workspaceId, Long facility, int days) {
        StringBuilder sql = new StringBuilder("""
            SELECT mode AS name, count(*) AS value
              FROM shipments
             WHERE workspace_id = ? AND created_at >= now() - (? || ' days')::interval
            """);
        List<Object> args = new ArrayList<>(Arrays.asList(workspaceId, days));
        if (facility != null) {
            sql.append(" AND origin_warehouse_id = ?");
            args.add(facility);
        }
        sql.append(" GROUP BY mode ORDER BY value DESC");
        return jdbcTemplate.queryForList(sql.toString(), args.toArray());
    }

    /** TrackingPage speed history for one trip; xKey="at", series "speedKph". */
    private List<Map<String, Object>> speed(String tripId) {
        if (tripId == null || tripId.isBlank()) {
            return List.of();
        }
        Long id;
        try {
            id = Long.valueOf(tripId.trim());
        } catch (NumberFormatException e) {
            return List.of();
        }
        return jdbcTemplate.queryForList(
            """
            SELECT at, speed_kph AS "speedKph"
              FROM trip_telemetry_samples
             WHERE trip_id = ?
             ORDER BY at DESC
             LIMIT 120
            """,
            id);
    }

    // ─────────────────────────── helpers ───────────────────────────

    /** AnalyticsPage and DashboardPage both send 7d/30d/90d/12m. */
    private static int rangeDays(String range) {
        if (range == null) {
            return 7;
        }
        String value = range.trim().toLowerCase(Locale.ROOT);
        try {
            if (value.endsWith("d")) {
                return Math.max(1, Integer.parseInt(value.substring(0, value.length() - 1)));
            }
            if (value.endsWith("m")) {
                return Math.max(1, Integer.parseInt(value.substring(0, value.length() - 1)) * 30);
            }
            if (value.endsWith("y")) {
                return Math.max(1, Integer.parseInt(value.substring(0, value.length() - 1)) * 365);
            }
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return 7;
        }
    }

    private double rate(String sql, Object... args) {
        Map<String, Object> row = jdbcTemplate.queryForMap(sql, args);
        long good = asLong(row.get("good"));
        long total = asLong(row.get("total"));
        return total == 0 ? 0d : Math.round((good * 10000d) / total) / 100d;
    }

    private long count(String sql, Object... args) {
        return asLong(jdbcTemplate.queryForMap(sql, args).values().iterator().next());
    }

    private double scalar(String sql, Object... args) {
        Object value = jdbcTemplate.queryForMap(sql, args).values().iterator().next();
        return value instanceof Number n ? n.doubleValue() : 0d;
    }

    private static long asLong(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }

    /** Rounded difference between the current window and the one before it. */
    private static double delta(Object current, double previous) {
        return current instanceof Number n
            ? Math.round((n.doubleValue() - previous) * 10d) / 10d
            : 0d;
    }
}
