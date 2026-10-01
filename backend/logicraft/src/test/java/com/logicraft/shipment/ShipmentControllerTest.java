package com.logicraft.shipment;

import static org.assertj.core.api.Assertions.assertThat;

import com.logicraft.support.RecordingJdbcTemplate;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Tests for the shipment list endpoint.
 *
 * The projection is the contract with ShipmentsPage, and the projection carries
 * two labels — an unassigned driver and an unassigned vehicle — that used to
 * render as empty cells. Timestamps matter just as much: JdbcTemplate hands back
 * java.sql.Timestamp for a timestamptz column, and a naive instanceof check on
 * OffsetDateTime would serialise a populated column as null.
 *
 * RecordingJdbcTemplate records the statements, so these assert the SQL, the
 * bound arguments and the DTOs, without a database.
 */
class ShipmentControllerTest {

    private RecordingJdbcTemplate jdbc;
    private ShipmentController controller;

    @BeforeEach
    void setUp() {
        jdbc = new RecordingJdbcTemplate();
        controller = new ShipmentController(jdbc);
    }

    // ── helpers ──────────────────────────────────────────────────────

    private ResponseEntity<?> list(String status, String mode, String q, String unassigned) {
        return controller.getShipments(1L, status, mode, q, unassigned, 0, 200);
    }

    private ResponseEntity<?> page(int page, int size) {
        return controller.getShipments(1L, null, null, null, null, page, size);
    }

    @SuppressWarnings("unchecked")
    private static List<ShipmentDTO> body(ResponseEntity<?> response) {
        return (List<ShipmentDTO>) response.getBody();
    }

    private static Map<String, Object> shipmentRow(long id, String reference) {
        return RecordingJdbcTemplate.row(
                "id", id, "reference", reference, "origin", "Chicago, IL",
                "destination", "Dallas, TX", "mode", "road", "status", "in_transit",
                "weightKg", new BigDecimal("1200.50"), "eta", null,
                "createdAt", null, "driverName", "Ada Lovelace", "vehiclePlate", "TRK-8801");
    }

    // ── scoping and shape ────────────────────────────────────────────

    @Nested
    @DisplayName("scoping")
    class Scoping {

        @Test
        void scopesByWorkspace() {
            list(null, null, null, null);
            assertThat(jdbc.lastSql()).contains("WHERE s.workspace_id = ?");
            assertThat(jdbc.lastArgs()).contains(1L);
        }

        @Test
        void bindsTheWorkspaceIdRatherThanInliningIt() {
            // Concatenating the id would let a crafted ?workspaceId change the
            // shape of the statement.
            list(null, null, null, null);
            assertThat(jdbc.lastSql()).doesNotContain("workspace_id = 1");
        }

        @Test
        void joinsDriverAndVehicleBecauseTheSearchReachesBoth() {
            // The q predicate references d.name and v.plate, so the joins have to
            // be there even when no other filter is set.
            list(null, null, "trk", null);
            assertThat(jdbc.lastSql())
                    .contains("LEFT JOIN drivers  d ON d.id = s.driver_id")
                    .contains("LEFT JOIN vehicles v ON v.id = s.vehicle_id");
        }

        @Test
        void ordersNewestFirst() {
            list(null, null, null, null);
            assertThat(jdbc.lastSql()).contains("ORDER BY s.id DESC");
        }
    }

    // ── filters ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("filters")
    class Filters {

        @Test
        void filtersOnStatus() {
            list("IN_TRANSIT", null, null, null);
            assertThat(jdbc.lastSql()).contains("AND s.status = ?");
            assertThat(jdbc.lastArgs()).contains("in_transit");
        }

        @Test
        void filtersOnMode() {
            list(null, "Road", null, null);
            assertThat(jdbc.lastSql()).contains("AND s.mode = ?");
            assertThat(jdbc.lastArgs()).contains("road");
        }

        @Test
        void treatsAllAsNoFilter() {
            // A tab id of "all" is a no-op, not a status literally named all.
            list("all", "all", null, null);
            assertThat(jdbc.lastSql())
                    .doesNotContain("s.status = ?")
                    .doesNotContain("s.mode = ?");
        }

        @Test
        void ignoresABlankFilter() {
            list("  ", "", null, "  ");
            assertThat(jdbc.lastSql())
                    .doesNotContain("s.status = ?")
                    .doesNotContain("s.mode = ?")
                    .doesNotContain("driver_id IS NULL")
                    .doesNotContain("LIKE");
        }

        @Test
        void filtersUnclaimedShipments() {
            // The assignment modal in DriversPage lists what is unclaimed.
            list(null, null, null, "true");
            assertThat(jdbc.lastSql()).contains("AND s.driver_id IS NULL");
        }

        @Test
        void doesNotFilterWhenUnassignedIsFalse() {
            list(null, null, null, "false");
            assertThat(jdbc.lastSql()).doesNotContain("driver_id IS NULL");
        }

        @Test
        void searchesReferenceRouteAndDriver() {
            list(null, null, "  CHI ", null);
            assertThat(jdbc.lastSql()).contains(
                    "lower(s.reference) LIKE ? OR lower(s.origin) LIKE ?",
                    "OR lower(s.destination) LIKE ? OR lower(d.name) LIKE ?",
                    "OR lower(v.plate) LIKE ?");
            assertThat(jdbc.lastArgs()).containsOnly("%chi%", 1L, 200, 0);
        }

        @Test
        void bindsOneArgumentPerSearchColumn() {
            // Five LIKE columns, five terms — a mismatch here silently narrows
            // the search to whichever column got the missing value.
            list(null, null, "chi", null);
            String statement = jdbc.lastSql();
            assertThat((long) jdbc.lastArgs().size())
                    .isEqualTo(statement.chars().filter(c -> c == '?').count());
        }

        @Test
        void combinesEveryFilterWithAnd() {
            list("in_transit", "sea", "chi", "true");
            assertThat(jdbc.lastSql())
                    .contains("WHERE s.workspace_id = ?")
                    .contains(" AND s.status = ?")
                    .contains(" AND s.mode = ?")
                    .contains(" AND s.driver_id IS NULL")
                    .contains(" AND (lower(s.reference) LIKE ?");
        }
    }

    // ── pagination ───────────────────────────────────────────────────

    @Nested
    @DisplayName("pagination")
    class Pagination {

        @Test
        void defaultsToTwoHundredRows() {
            list(null, null, null, null);
            assertThat(jdbc.lastArgs()).contains(200, 0);
        }

        @Test
        void appliesThePageAsAnOffset() {
            page(2, 25);
            assertThat(jdbc.lastArgs()).contains(25, 50);
        }

        @Test
        void capsThePageSizeAtAThousand() {
            page(0, 9000);
            assertThat(jdbc.lastArgs()).contains(1000);
        }

        @Test
        void fallsBackToTheDefaultForANonPositiveSize() {
            page(0, 0);
            assertThat(jdbc.lastArgs()).contains(200);
        }

        @Test
        void neverReturnsANegativeOffset() {
            page(-3, 20);
            assertThat(jdbc.lastArgs()).contains(20, 0);
        }

        @Test
        void appendsLimitAfterTheFilterArguments() {
            // LIMIT/OFFSET come last in the statement, so they must be last in
            // the bound arguments too.
            list("in_transit", null, null, null);
            assertThat(jdbc.lastArgs()).containsExactly(1L, "in_transit", 200, 0);
        }
    }

    // ── projection ───────────────────────────────────────────────────

    @Nested
    @DisplayName("projection")
    class Projection {

        @Test
        void mapsTheColumnsTheTableReads() {
            jdbc.returning(List.of(shipmentRow(1, "SHP-1001")));
            ShipmentDTO dto = body(list(null, null, null, null)).get(0);
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getReference()).isEqualTo("SHP-1001");
            assertThat(dto.getOrigin()).isEqualTo("Chicago, IL");
            assertThat(dto.getDestination()).isEqualTo("Dallas, TX");
            assertThat(dto.getMode()).isEqualTo("road");
            assertThat(dto.getStatus()).isEqualTo("in_transit");
            assertThat(dto.getDriverName()).isEqualTo("Ada Lovelace");
            assertThat(dto.getVehiclePlate()).isEqualTo("TRK-8801");
            assertThat(dto.getWeightKg()).isEqualByComparingTo("1200.50");
        }

        @Test
        void carriesTheFallbackLabelsInTheProjection() {
            // A shipment that has not been picked up has no driver and no
            // vehicle; a null there rendered as an empty cell.
            list(null, null, null, null);
            assertThat(jdbc.lastSql())
                    .contains("COALESCE(d.name, 'Unassigned') AS \"driverName\"")
                    .contains("COALESCE(v.plate, 'Not assigned') AS \"vehiclePlate\"");
        }

        @Test
        void leavesAnUnassignedDriverAsTheLabel() {
            jdbc.returning(List.of(RecordingJdbcTemplate.row(
                    "id", 2L, "reference", "SHP-1002", "driverName", "Unassigned",
                    "vehiclePlate", "Not assigned", "eta", null, "createdAt", null)));
            ShipmentDTO dto = body(list(null, null, null, null)).get(0);
            assertThat(dto.getDriverName()).isEqualTo("Unassigned");
            assertThat(dto.getVehiclePlate()).isEqualTo("Not assigned");
        }

        @Test
        void leavesANullWeightAsNull() {
            jdbc.returning(List.of(RecordingJdbcTemplate.row("id", 3L, "weightKg", null)));
            assertThat(body(list(null, null, null, null)).get(0).getWeightKg()).isNull();
        }

        @Test
        void ignoresANonNumericWeight() {
            jdbc.returning(List.of(RecordingJdbcTemplate.row("id", 3L, "weightKg", "1200kg")));
            assertThat(body(list(null, null, null, null)).get(0).getWeightKg()).isNull();
        }
    }

    // ── timestamps ───────────────────────────────────────────────────

    @Nested
    @DisplayName("timestamps")
    class Timestamps {

        @Test
        void normalisesADriverTimestamp() {
            // This is what the driver actually hands back for timestamptz, and
            // an instanceof OffsetDateTime check alone would drop it.
            Timestamp value = Timestamp.from(Instant.parse("2026-01-05T10:15:30Z"));
            jdbc.returning(List.of(RecordingJdbcTemplate.row(
                    "id", 1L, "eta", value, "createdAt", value)));

            ShipmentDTO dto = body(list(null, null, null, null)).get(0);
            assertThat(dto.getEta()).isEqualTo(OffsetDateTime.parse("2026-01-05T10:15:30Z"));
            assertThat(dto.getCreatedAt()).isEqualTo(OffsetDateTime.parse("2026-01-05T10:15:30Z"));
        }

        @Test
        void passesThroughAnOffsetDateTime() {
            OffsetDateTime value = OffsetDateTime.parse("2026-02-01T08:00:00+05:30");
            jdbc.returning(List.of(RecordingJdbcTemplate.row("id", 1L, "eta", value)));
            assertThat(body(list(null, null, null, null)).get(0).getEta()).isEqualTo(value);
        }

        @Test
        void passesThroughAnInstant() {
            Instant value = Instant.parse("2026-03-09T23:00:00Z");
            jdbc.returning(List.of(RecordingJdbcTemplate.row("id", 1L, "eta", value)));
            assertThat(body(list(null, null, null, null)).get(0).getEta())
                    .isEqualTo(value.atOffset(ZoneOffset.UTC));
        }

        @Test
        void acceptsALocalDateTime() {
            jdbc.returning(List.of(RecordingJdbcTemplate.row(
                    "id", 1L, "eta", LocalDateTime.of(2026, 4, 1, 12, 0))));
            assertThat(body(list(null, null, null, null)).get(0).getEta()).isNotNull();
        }

        @Test
        void leavesANullTimestampNull() {
            // A shipment with no ETA is a real state, not a missing value.
            jdbc.returning(List.of(RecordingJdbcTemplate.row(
                    "id", 1L, "eta", null, "createdAt", null)));
            ShipmentDTO dto = body(list(null, null, null, null)).get(0);
            assertThat(dto.getEta()).isNull();
            assertThat(dto.getCreatedAt()).isNull();
        }
    }

    // ── milestones ───────────────────────────────────────────────────

    @Nested
    @DisplayName("milestones")
    class Milestones {

        private static Map<String, Object> milestone(long shipmentId, String status, String at) {
            return RecordingJdbcTemplate.row(
                    "shipment_id", shipmentId, "status", status, "at", at,
                    "timestamp", at, "location", "Dallas Hub", "note", null);
        }

        @Test
        void loadsEveryShipmentsMilestonesInOneQuery() {
            // A query per row would be an N+1 across a 200-row page.
            jdbc.returningInOrder(
                    List.of(shipmentRow(1, "SHP-1001"), shipmentRow(2, "SHP-1002")),
                    List.of(milestone(1, "picked_up", "2026-01-01T08:00:00Z")));
            body(list(null, null, null, null));

            assertThat(jdbc.queries()).hasSize(2);
            assertThat(jdbc.queries().get(1).sql())
                    .contains("FROM shipment_milestones")
                    .contains("WHERE shipment_id IN (?,?)");
            assertThat(jdbc.queries().get(1).argsList()).containsExactly(1L, 2L);
        }

        @Test
        void groupsMilestonesByShipment() {
            jdbc.returningInOrder(
                    List.of(shipmentRow(1, "SHP-1001"), shipmentRow(2, "SHP-1002")),
                    List.of(
                            milestone(1, "picked_up", "2026-01-01T08:00:00Z"),
                            milestone(1, "in_transit", "2026-01-02T08:00:00Z"),
                            milestone(2, "delivered", "2026-01-03T08:00:00Z")));

            List<ShipmentDTO> dtos = body(list(null, null, null, null));
            assertThat(dtos.get(0).getMilestones()).hasSize(2);
            assertThat(dtos.get(1).getMilestones()).hasSize(1);
        }

        @Test
        void suppliesBothTimestampSpellingsStepperReads() {
            // Stepper.tsx reads `at` with `timestamp` as its fallback.
            jdbc.returningInOrder(
                    List.of(shipmentRow(1, "SHP-1001")),
                    List.of(milestone(1, "picked_up", "2026-01-01T08:00:00Z")));

            Map<String, Object> step = body(list(null, null, null, null)).get(0).getMilestones().get(0);
            assertThat(step).containsEntry("status", "picked_up");
            assertThat(step).containsEntry("at", "2026-01-01T08:00:00Z");
            assertThat(step).containsEntry("timestamp", "2026-01-01T08:00:00Z");
            assertThat(step).containsEntry("location", "Dallas Hub");
        }

        @Test
        void givesAShipmentWithNoMilestonesAnEmptyList() {
            // Stepper maps over the list; a null here would throw in the browser
            // rather than render "no steps yet".
            jdbc.returningInOrder(List.of(shipmentRow(1, "SHP-1001")), List.of());
            assertThat(body(list(null, null, null, null)).get(0).getMilestones()).isEmpty();
        }

        @Test
        void skipsTheMilestoneQueryForAnEmptyPage() {
            body(list(null, null, null, null));
            assertThat(jdbc.queries()).hasSize(1);
        }

        @Test
        void ordersTheStepsForTheStepperToReadForward() {
            jdbc.returningInOrder(
                    List.of(shipmentRow(1, "SHP-1001")),
                    List.of(milestone(1, "picked_up", "2026-01-01T08:00:00Z")));
            body(list(null, null, null, null));
            assertThat(jdbc.queries().get(1).sql())
                    .contains("ORDER BY shipment_id, seq, at");
        }
    }

    // ── count ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("count")
    class Count {

        @Test
        void countsOnlyDeliveredNothingLess() {
            // The pagination control asks for the total, not the page.
            jdbc.returningScalar(4242L);
            ResponseEntity<?> response = controller.countShipments(1L, null, null, null, null);
            assertThat(response.getBody()).isEqualTo(Map.of("count", 4242L));
        }

        @Test
        void keepsTheSameFiltersAsTheList() {
            jdbc.returningScalar(7L);
            controller.countShipments(1L, "in_transit", "road", "chi", "true");
            assertThat(jdbc.lastSql())
                    .contains("WHERE s.workspace_id = ?")
                    .contains(" AND s.status = ?")
                    .contains(" AND s.mode = ?")
                    .contains(" AND s.driver_id IS NULL")
                    .contains(" AND (lower(s.reference) LIKE ?");
            // One term per LIKE column, and no LIMIT: this is the total.
            assertThat(jdbc.lastArgs())
                    .containsExactly(1L, "in_transit", "road",
                            "%chi%", "%chi%", "%chi%", "%chi%", "%chi%");
        }

        @Test
        void sendsNoLimitOrOffset() {
            jdbc.returningScalar(7L);
            controller.countShipments(1L, null, null, null, null);
            assertThat(jdbc.lastSql()).doesNotContain("LIMIT");
        }

        @Test
        void reportsZeroForAnEmptyTable() {
            jdbc.returningScalar(null);
            assertThat(controller.countShipments(1L, null, null, null, null).getBody())
                    .isEqualTo(Map.of("count", 0L));
        }
    }

    // ── failures ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("failures")
    class Failures {

        @Test
        void returns500WithTheMessageRatherThanPropagating() {
            jdbc.failsWith(new IllegalStateException("connection reset"));
            ResponseEntity<?> response = list(null, null, null, null);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).isEqualTo(Map.of("error", "connection reset"));
        }

        @Test
        void returns500FromTheCountEndpointToo() {
            jdbc.failsWith(new IllegalStateException("connection reset"));
            assertThat(controller.countShipments(1L, null, null, null, null).getStatusCode())
                    .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        @Test
        void returns500WhenTheMilestoneQueryFails() {
            jdbc.returning(List.of(shipmentRow(1, "SHP-1001")));
            jdbc.failsWith(new IllegalStateException("connection reset"));
            assertThat(list(null, null, null, null).getStatusCode())
                    .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
