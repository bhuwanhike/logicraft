package com.logicraft.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.logicraft.support.DriverValues;
import com.logicraft.support.RecordingJdbcTemplate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Tests for the generic resource endpoints.
 *
 * Two things are being protected. The column aliases are the contract with the
 * workspace UI: a projection that reverts to the Postgres column labels
 * (odometer_km rather than odometerKm) renders an em-dash with no error
 * anywhere, so the SQL is asserted directly. The filter builder is the other
 * half — every value bound as a parameter and appended in the same order as its
 * placeholder — so the bound arguments are captured and checked too.
 *
 * RecordingJdbcTemplate records the statement instead of executing it, so these
 * run without Postgres and assert exactly what the controller sends.
 */
class GenericControllerTest {

    /**
     * An alias is either quoted camelCase or a bare lowercase word. A quoted
     * camelCase alias is what Postgres preserves; an unquoted one it folds to
     * lower case, which is how a column silently stops matching the UI.
     */
    private static final Pattern ALIAS = Pattern.compile("(\"[^\"]+\"|[A-Za-z][A-Za-z0-9_]*)");

    private RecordingJdbcTemplate jdbc;
    private GenericController controller;

    @BeforeEach
    void setUp() {
        jdbc = new RecordingJdbcTemplate();
        controller = new GenericController(jdbc);
    }

    // ── helpers ──────────────────────────────────────────────────────

    /** GET /{resource} with no filters. */
    private ResponseEntity<?> list(String resource) {
        return controller.getResource(resource, 1L, null, null, null, null, null, null, null, 0, 200);
    }

    /** GET /{resource} with the filter parameters the workspace sends. */
    private ResponseEntity<?> list(
            String resource, String q, String status, String type,
            String level, String read, String movements, Long warehouseId) {
        return controller.getResource(
                resource, 1L, q, status, type, level, read, movements, warehouseId, 0, 200);
    }

    /** GET /{resource} with explicit paging. */
    private ResponseEntity<?> page(String resource, int page, int size) {
        return controller.getResource(
                resource, 1L, null, null, null, null, null, null, null, page, size);
    }

    private String sqlFor(String resource) {
        list(resource);
        return jdbc.lastSql();
    }

    private static boolean quoted(String alias) {
        return alias.startsWith("\"") && alias.endsWith("\"");
    }

    private static String unquote(String alias) {
        return quoted(alias) ? alias.substring(1, alias.length() - 1) : alias;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> firstRow(ResponseEntity<?> response) {
        return (Map<String, Object>) ((List<?>) response.getBody()).get(0);
    }

    // ── unknown resources ────────────────────────────────────────────

    @Nested
    @DisplayName("unknown resources")
    class UnknownResources {

        @Test
        void returns404RatherThanAnEmptyList() {
            // An empty list would render as "no data" and read as a working page.
            ResponseEntity<?> response = list("nope");
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(response.getBody()).isEqualTo(Map.of("error", "Unknown resource: nope"));
        }

        @Test
        void doesNotQueryTheDatabase() {
            list("nope");
            assertThat(jdbc.queryCount()).isZero();
        }

        @Test
        void returns404ForAnUnknownCount() {
            assertThat(controller.countResource("nope").getStatusCode())
                    .isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(controller.countResource("nope").getBody())
                    .isEqualTo(Map.of("error", "Unknown resource: nope"));
            assertThat(jdbc.queryCount()).isZero();
        }

        @Test
        void namesTheResourceInTheError() {
            // The message is the only clue when a page shows the error body.
            assertThat(String.valueOf(list("widgets").getBody())).contains("widgets");
        }
    }

    // ── projections ──────────────────────────────────────────────────

    @Nested
    @DisplayName("projections")
    class Projections {

        @Test
        void aliasesEveryColumnTheVehiclesTableReads() {
            // These are the exact names VehiclesPage reads off a row.
            assertThat(sqlFor("vehicles"))
                    .contains("AS \"capacityKg\"", "AS \"fuelLevel\"", "AS \"odometerKm\"",
                            "AS \"lastServiceAt\"", "AS \"nextServiceAt\"", "AS \"locationLabel\"",
                            "AS \"createdAt\"", "AS \"currentDriverName\"", "AS \"documentCount\"");
        }

        @Test
        void aliasesEveryColumnTheDriversTableReads() {
            assertThat(sqlFor("drivers"))
                    .contains("AS \"licenseNumber\"", "AS \"licenseExpiry\"", "AS \"safetyScore\"",
                            "AS \"tripsCompleted\"", "AS \"weeklyHours\"", "AS \"joinedAt\"");
        }

        @Test
        void aliasesEveryColumnTheTripsTableReads() {
            assertThat(sqlFor("trips"))
                    .contains("AS \"speedKph\"", "AS \"fuelLevel\"", "AS \"headingDeg\"",
                            "AS \"distanceKm\"", "AS \"lastReportedAt\"", "AS \"driverName\"",
                            "AS \"vehiclePlate\"");
        }

        @Test
        void aliasesEveryColumnTheZonesTableReads() {
            assertThat(sqlFor("zones"))
                    .contains("AS \"warehouseId\"", "AS \"capacityUnits\"", "AS \"usedCapacity\"",
                            "AS \"dockDoors\"", "AS \"temperatureControlled\"");
        }

        @Test
        void neverLeavesAnAliasPostgresWouldFold() {
            // An unquoted camelCase alias reaches the client lower-cased
            // (odometerkm), which matches no key the UI reads and renders an
            // em-dash instead of throwing. An alias in snake_case is the same bug
            // in the other direction: even quoted, no UI key matches it.
            List<String> checked = new ArrayList<>();
            for (String resource : List.of("vehicles", "drivers", "warehouses", "zones",
                    "inventory", "stock-movements", "trips", "notifications", "audit-logs", "users")) {
                for (String alias : aliasesOf(sqlFor(resource))) {
                    String key = unquote(alias);
                    checked.add(key);
                    assertThat(key)
                        .as("%s: alias should be lowerCamelCase, not snake_case", resource)
                        .matches("[a-z][A-Za-z0-9]*");
                    if (!key.equals(key.toLowerCase(Locale.ROOT))) {
                        assertThat(quoted(alias))
                            .as("%s: %s must be quoted or Postgres folds it to %s",
                                resource, key, key.toLowerCase(Locale.ROOT))
                            .isTrue();
                    }
                }
            }
            // Guards the loop above: a projection whose aliases were never
            // reached would otherwise satisfy it trivially.
            assertThat(checked).hasSizeGreaterThan(50);
        }

        /** Every alias in a projection, unquoted. */
        private List<String> aliasesOf(String projection) {
            List<String> aliases = new ArrayList<>();
            for (String line : projection.split("\\R")) {
                String trimmed = line.strip();
                if (trimmed.startsWith("--") || !trimmed.contains(" AS ")) {
                    continue;
                }
                String tail = trimmed.substring(trimmed.lastIndexOf(" AS ") + 4);
                Matcher matcher = ALIAS.matcher(tail);
                if (matcher.find()) {
                    aliases.add(matcher.group(1));
                }
            }
            return aliases;
        }

        @Test
        void substitutesALabelForAnUnassignedTripDriver() {
            assertThat(sqlFor("trips")).contains("COALESCE(d.name, 'Unassigned')");
        }

        @Test
        void substitutesALabelForAnUnassignedTripVehicle() {
            assertThat(sqlFor("trips")).contains("COALESCE(v.plate, t.plate)");
        }

        @Test
        void substitutesALabelForTheNullUserAgentOnSeededAuditRows() {
            // audit_logs is append-only, so a null here can never be corrected
            // afterwards and the projection has to say something instead.
            assertThat(sqlFor("audit-logs")).contains("COALESCE(a.user_agent, 'Recorded by service')");
        }

        @Test
        void fallsBackToTheUsernameWhenAUserHasNoRole() {
            assertThat(sqlFor("users")).contains("COALESCE(r.display_name, u.username) AS role");
        }

        @Test
        void labelsAnUnassignedInventoryZone() {
            assertThat(sqlFor("inventory")).contains("COALESCE(z.code, 'unassigned') AS zone");
        }

        @Test
        void takesTheHighestRankedRoleForAUser() {
            // A user can hold several roles; the UI shows one.
            assertThat(sqlFor("users")).contains("ORDER BY ro.rank", "LIMIT 1");
        }

        @Test
        void countsVehicleDocumentsInTheProjectionRatherThanPerRow() {
            // A correlated subquery is one pass; a second round trip per row is an
            // N+1 across a 200-row page.
            assertThat(sqlFor("vehicles")).contains("(SELECT COUNT(*) FROM vehicle_documents");
        }

        @Test
        void servesBothNotificationTimestampNames() {
            // NotificationsPage sorts on createdAt while the map/list columns read
            // at; one row satisfies both.
            assertThat(sqlFor("notifications"))
                    .contains("AS at", "AS \"createdAt\"", "AS message", "AS detail");
        }

        @Test
        void routesStockMovementsThroughTheMovementsFlag() {
            // GET /inventory?movements=true serves a different table from the same
            // path, so the branch has to happen before the projection is looked up.
            list("inventory", null, null, null, null, null, "true", null);
            assertThat(jdbc.lastSql()).contains("FROM stock_movements m");
        }

        @Test
        void acceptsMovementsAsOne() {
            list("inventory", null, null, null, null, null, "1", null);
            assertThat(jdbc.lastSql()).contains("FROM stock_movements m");
        }

        @Test
        void treatsAnyOtherMovementsValueAsFalse() {
            list("inventory", null, null, null, null, null, "yes", null);
            assertThat(jdbc.lastSql()).contains("FROM inventory_items i");
        }
    }

    // ── scoping ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("workspace scoping")
    class Scoping {

        @Test
        void scopesATopLevelResourceByItsOwnColumn() {
            assertThat(sqlFor("vehicles")).contains("WHERE v.workspace_id = ?");
        }

        @Test
        void scopesAChildResourceThroughTheWarehouseJoin() {
            // zones has no workspace_id of its own; it hangs off warehouses.
            assertThat(sqlFor("zones")).contains("WHERE w.workspace_id = ?");
        }

        @Test
        void scopesInventoryThroughTheWarehouseJoin() {
            assertThat(sqlFor("inventory")).contains("WHERE w.workspace_id = ?");
        }

        @Test
        void scopesStockMovementsThroughTheWarehouseJoin() {
            assertThat(sqlFor("stock-movements")).contains("WHERE w.workspace_id = ?");
        }

        @Test
        void scopesAuditLogsByItsOwnColumn() {
            assertThat(sqlFor("audit-logs")).contains("WHERE a.workspace_id = ?");
        }

        @Test
        void includesUnassignedUsersInEveryWorkspace() {
            // An admin with workspace_id null is visible to all of them.
            assertThat(sqlFor("users"))
                    .contains("WHERE (u.workspace_id IS NULL OR u.workspace_id = ?)");
        }

        @Test
        void bindsTheWorkspaceIdAsAParameterRatherThanInliningIt() {
            // String-concatenating the id would let ?workspaceId=1%20OR%201=1
            // change the shape of the statement.
            list("vehicles");
            assertThat(jdbc.lastSql()).doesNotContain("workspace_id = 1");
            assertThat(jdbc.lastArgs()).contains(1L);
        }

        @Test
        void scopesUsersToTheRequestedWorkspaceOnly() {
            controller.getResource("users", 42L, null, null, null, null, null, null, null, 0, 200);
            assertThat(jdbc.lastArgs()).contains(42L);
        }
    }

    // ── filters ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("filters")
    class Filters {

        @Test
        void searchesVehiclesByPlateVinAndMake() {
            list("vehicles", "trk", null, null, null, null, null, null);
            assertThat(jdbc.lastSql())
                    .contains("lower(v.plate) LIKE ?", "lower(v.vin) LIKE ?", "lower(v.make) LIKE ?");
            assertThat(jdbc.lastArgs()).containsOnly("%trk%", 1L, 200, 0);
        }

        @Test
        void searchesDriversByNameLicenceAndEmail() {
            list("drivers", "ada", null, null, null, null, null, null);
            assertThat(jdbc.lastSql())
                    .contains("lower(d.name) LIKE ?", "lower(d.license_number) LIKE ?",
                            "lower(d.email) LIKE ?");
        }

        @Test
        void searchesTripsByReferencePlateOriginAndDestination() {
            list("trips", "chi", null, null, null, null, null, null);
            assertThat(jdbc.lastSql())
                    .contains("lower(t.reference) LIKE ?", "lower(t.plate) LIKE ?",
                            "lower(t.origin) LIKE ?", "lower(t.destination) LIKE ?");
        }

        @Test
        void searchesWarehousesAndZonesByName() {
            list("warehouses", "north", null, null, null, null, null, null);
            assertThat(jdbc.lastSql()).contains("lower(w.name) LIKE ?");
        }

        @Test
        void searchesInventoryBySkuAndName() {
            list("inventory", "bolt", null, null, null, null, null, null);
            assertThat(jdbc.lastSql()).contains("lower(i.sku) LIKE ?", "lower(i.name) LIKE ?");
        }

        @Test
        void trimsAndLowercasesTheSearchTerm() {
            list("vehicles", "  TRK  ", null, null, null, null, null, null);
            assertThat(jdbc.lastArgs()).contains("%trk%");
        }

        @Test
        void ignoresABlankSearch() {
            list("vehicles", "   ", null, null, null, null, null, null);
            assertThat(jdbc.lastSql()).doesNotContain("LIKE");
        }

        @Test
        void filtersOnStatus() {
            list("vehicles", null, "ACTIVE", null, null, null, null, null);
            assertThat(jdbc.lastSql()).contains("AND v.status = ?");
            assertThat(jdbc.lastArgs()).contains("active");
        }

        @Test
        void ignoresTheAllStatus() {
            // A tab id of "all" is a no-op, not a filter for a status named all.
            list("vehicles", null, "all", null, null, null, null, null);
            assertThat(jdbc.lastSql()).doesNotContain("status = ?");
        }

        @Test
        void filtersOnType() {
            list("vehicles", null, null, "TRUCK", null, null, null, null);
            assertThat(jdbc.lastSql()).contains("AND v.type = ?");
            assertThat(jdbc.lastArgs()).contains("truck");
        }

        @Test
        void filtersNotificationsOnACommaSeparatedLevelList() {
            // DashboardPage sends level=critical,warning — one parameter, because
            // services/api.ts joins arrays itself.
            list("notifications", null, null, null, "critical, warning", null, null, null);
            assertThat(jdbc.lastSql()).contains("AND n.level IN (?, ?)");
            assertThat(jdbc.lastArgs()).contains("critical", "warning");
        }

        @Test
        void deduplicatesALevelList() {
            list("notifications", null, null, null, "critical,critical", null, null, null);
            assertThat(jdbc.lastSql()).contains("IN (?)");
            assertThat(jdbc.lastArgs()).contains("critical");
        }

        @Test
        void filtersOnReadStateAsABoolean() {
            list("notifications", null, null, null, null, "false", null, null);
            assertThat(jdbc.lastSql()).contains("AND n.is_read = ?");
            assertThat(jdbc.lastArgs()).contains(Boolean.FALSE);
        }

        @Test
        void distinguishesAnAbsentReadFilterFromFalse() {
            // The UI compares read === false, so an unset filter must not be sent
            // as false or it would hide every already-read notification. The
            // projection always selects is_read; the filter is the equality test.
            list("notifications", null, null, null, null, "", null, null);
            assertThat(jdbc.lastSql()).doesNotContain("is_read = ?");
        }

        @Test
        void narrowsToOneWarehouseWhenAsked() {
            // The warehouse filter is the outer one, so it opens the WHERE.
            list("zones", null, null, null, null, null, null, 7L);
            assertThat(jdbc.lastSql()).contains("WHERE w.id = ?", "AND w.workspace_id = ?");
            assertThat(jdbc.lastArgs()).containsExactly(7L, 1L, 200, 0);
        }

        @Test
        void combinesEveryFilterWithAnd() {
            list("vehicles", "trk", "active", "truck", null, null, null, null);
            assertThat(jdbc.lastSql())
                    .contains("WHERE v.workspace_id = ?")
                    .contains(" AND (lower(v.plate) LIKE ?")
                    .contains(" AND v.status = ?")
                    .contains(" AND v.type = ?");
        }

        @Test
        void bindsOneArgumentPerPlaceholder() {
            // The filter builder appends placeholders and values independently, so
            // a mismatch here is a wrong row rather than an error.
            list("vehicles", "trk", "active", "truck", null, null, null, null);
            String statement = jdbc.lastSql();
            long placeholders = statement.chars().filter(c -> c == '?').count();
            assertThat((long) jdbc.lastArgs().size()).isEqualTo(placeholders);
        }
    }

    // ── pagination ───────────────────────────────────────────────────

    @Nested
    @DisplayName("pagination")
    class Pagination {

        @Test
        void defaultsToTwoHundredRows() {
            list("vehicles");
            assertThat(jdbc.lastArgs()).contains(200, 0);
        }

        @Test
        void appliesThePageAsAnOffset() {
            page("vehicles", 3, 50);
            assertThat(jdbc.lastArgs()).contains(50, 150);
        }

        @Test
        void capsThePageSizeAtAThousand() {
            page("vehicles", 0, 5000);
            assertThat(jdbc.lastArgs()).contains(1000);
        }

        @Test
        void fallsBackToTheDefaultForANonPositiveSize() {
            // A size of 0 would otherwise be LIMIT 1 and return a single row.
            page("vehicles", 0, 0);
            assertThat(jdbc.lastArgs()).contains(200);
        }

        @Test
        void neverReturnsANegativeOffset() {
            page("vehicles", -2, 20);
            assertThat(jdbc.lastArgs()).contains(20, 0);
        }

        @Test
        void ordersDeterministicallySoAPageDoesNotRepeatRows() {
            assertThat(sqlFor("vehicles")).contains("ORDER BY 1 LIMIT ? OFFSET ?");
        }
    }

    // ── value sanitising ─────────────────────────────────────────────

    @Nested
    @DisplayName("sanitising")
    class Sanitising {

        @Test
        void unwrapsATextArrayColumn() {
            // A TEXT[] column arrives as a PgArray; left alone Jackson renders a
            // bean and the cell formatter shows [object Object].
            jdbc.returning(DriverValues.map(
                    "id", 1L, "name", "Ada", "certifications", DriverValues.textArray(
                            new String[] {"CDL-A", "Tanker"})));

            assertThat(firstRow(list("drivers")))
                    .containsEntry("certifications", new String[] {"CDL-A", "Tanker"})
                    .containsEntry("name", "Ada");
        }

        @Test
        void yieldsAnEmptyListForANullArray() {
            jdbc.returning(DriverValues.map("id", 1L, "certifications", DriverValues.textArray(null)));
            assertThat(firstRow(list("drivers"))).containsEntry("certifications", List.of());
        }

        @Test
        void yieldsAnEmptyListWhenTheArrayCannotBeRead() {
            // A failure here must not blank the whole page.
            jdbc.returning(DriverValues.map(
                    "id", 1L, "certifications", DriverValues.brokenArray("connection closed")));
            assertThat(firstRow(list("drivers"))).containsEntry("certifications", List.of());
        }

        @Test
        void unwrapsAJsonbColumnToItsText() {
            jdbc.returning(DriverValues.map(
                    "id", 1L, "meta", DriverValues.jsonb("{\"plate\":\"TRK-8801\"}")));

            assertThat(DriverValues.jsonb("{}").getClass().getName())
                    .as("the driver must be on the test classpath for this to mean anything")
                    .isEqualTo(DriverValues.PGOBJECT);
            assertThat(firstRow(list("vehicles")))
                    .containsEntry("meta", "{\"plate\":\"TRK-8801\"}");
        }

        @Test
        void leavesOrdinaryValuesAlone() {
            jdbc.returning(DriverValues.map(
                    "id", 1L, "plate", "TRK-8801", "fuelLevel", 72.5, "odometerKm", 123456L,
                    "currentDriverName", null));

            assertThat(firstRow(list("vehicles")))
                    .containsEntry("plate", "TRK-8801")
                    .containsEntry("fuelLevel", 72.5)
                    .containsEntry("odometerKm", 123456L)
                    // A semantic null stays null; only the label substitutions in
                    // SQL are allowed to invent a value.
                    .containsEntry("currentDriverName", null);
        }

        @Test
        void doesNotMutateTheRowItWasGiven() {
            var original = DriverValues.map("id", 1L, "certifications",
                    DriverValues.textArray(new String[] {"CDL-A"}));
            jdbc.returning(original);
            list("drivers");
            assertThat(original.get("certifications")).isInstanceOf(java.sql.Array.class);
        }

        @Test
        void returnsAnEmptyListForNoRows() {
            ResponseEntity<?> response = list("vehicles");
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat((List<?>) response.getBody()).isEmpty();
        }
    }

    // ── count ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("count")
    class Count {

        @Test
        void countsTheRightTable() {
            jdbc.returningScalar(7L);
            controller.countResource("vehicles");
            assertThat(jdbc.lastSql()).isEqualTo("SELECT COUNT(*) FROM vehicles");
            assertThat(jdbc.lastArgs()).isEmpty();
        }

        @Test
        void mapsInventoryOntoItsTableName() {
            // The path segment is "inventory" but the table is inventory_items.
            jdbc.returningScalar(7L);
            controller.countResource("inventory");
            assertThat(jdbc.lastSql()).isEqualTo("SELECT COUNT(*) FROM inventory_items");
        }

        @Test
        void mapsAuditLogsOntoItsTableName() {
            jdbc.returningScalar(7L);
            controller.countResource("audit-logs");
            assertThat(jdbc.lastSql()).isEqualTo("SELECT COUNT(*) FROM audit_logs");
        }

        @Test
        void returnsTheCount() {
            jdbc.returningScalar(1234L);
            ResponseEntity<?> response = controller.countResource("vehicles");
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isEqualTo(Map.of("count", 1234L));
        }

        @Test
        void reportsZeroRatherThanNullForAnEmptyTable() {
            jdbc.returningScalar(null);
            assertThat(controller.countResource("vehicles").getBody()).isEqualTo(Map.of("count", 0L));
        }
    }

    // ── failures ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("failures")
    class Failures {

        @Test
        void returns500WithTheMessageRatherThanPropagating() {
            jdbc.failsWith(new IllegalStateException("connection reset"));

            ResponseEntity<?> response = list("vehicles");
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).isEqualTo(Map.of("error", "connection reset"));
        }

        @Test
        void returns500ForAnUnknownColumnToo() {
            jdbc.failsWith(new IllegalStateException(
                    "column v.odometer_km does not exist"));
            assertThat(list("vehicles").getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        @Test
        void doesNotLeakTheExceptionType() {
            jdbc.failsWith(new IllegalStateException("relation \"vehicles\" does not exist"));
            assertThat(String.valueOf(list("vehicles").getBody()))
                    .doesNotContain("IllegalStateException")
                    .contains("relation");
        }

        @Test
        void returns500FromTheCountEndpointToo() {
            jdbc.failsWith(new IllegalStateException("connection reset"));
            assertThat(controller.countResource("vehicles").getStatusCode())
                    .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        @Test
        void failsLoudlyWhenAStubIsNotGivenAResult() {
            // Guards the stub itself: a silent default would make every
            // assertion above pass against no data.
            assertThatThrownBy(() -> jdbc.lastSql())
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("No statement");
        }
    }
}
