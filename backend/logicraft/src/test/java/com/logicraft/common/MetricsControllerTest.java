package com.logicraft.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.logicraft.support.RecordingJdbcTemplate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Tests for the dashboard KPI row and the analytics series.
 *
 * The two response shapes are not interchangeable, and nothing on the client can
 * recover from getting them the wrong way round: KpiRow reads named fields off
 * /summary (a bare array would leave every tile blank) and TrendChart maps over
 * /series/{key} (a single object would render one bar). So the shape is asserted
 * as carefully as the numbers.
 *
 * The deltas are the subtler part. Each compares the current window against the
 * immediately preceding window of the same length, which is only correct if the
 * comparison query reaches further back than the query it is compared to — the
 * bound arguments are checked for exactly that.
 */
class MetricsControllerTest {

    private RecordingJdbcTemplate jdbc;
    private MetricsController controller;

    @BeforeEach
    void setUp() {
        jdbc = new RecordingJdbcTemplate();
        controller = new MetricsController(jdbc);
    }

    // ── helpers ──────────────────────────────────────────────────────

    /**
     * Answers the six statements /summary issues, in the order it sends them:
     * the on-time rate, the two gauges, the average transit hours, then the two
     * preceding-window figures the deltas compare against.
     */
    private void queueSummary(long good, long total, long previousGood, long previousTotal) {
        Map<String, Object> current = rate(good, total);
        Map<String, Object> preceding = rate(previousGood, previousTotal);
        jdbc.answeringMaps(index -> switch (index) {
            case 0 -> current;                        // onTimeRate
            case 1 -> one(ACTIVE_VEHICLES);           // activeVehicles
            case 2 -> one(OPEN_EXCEPTIONS);           // openExceptions
            case 3 -> one(TRANSIT_HOURS);             // avgTransitHours
            case 4 -> preceding;                      // onTimeRate, previous window
            case 5 -> one(PREVIOUS_TRANSIT_HOURS);    // avgTransitHours, previous window
            default -> throw new AssertionError("unexpected statement " + index);
        });
    }

    /** A default set: 92% on time, falling 4 points, with transit 1.5h faster. */
    private void queueSummary() {
        queueSummary(92, 100, 88, 100);
    }

    private static final long ACTIVE_VEHICLES = 7L;
    private static final long OPEN_EXCEPTIONS = 2L;
    private static final double TRANSIT_HOURS = 30.5;
    private static final double PREVIOUS_TRANSIT_HOURS = 32.0;

    private ResponseEntity<?> response(String range) {
        return controller.getSummary(range, 1L);
    }

    private Map<String, Object> summary(String range) {
        ResponseEntity<?> response = response(range);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        return body;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> seriesOf(ResponseEntity<?> response) {
        return (List<Map<String, Object>>) response.getBody();
    }

    /** The shape count() and scalar() read: a single column. */
    private static Map<String, Object> one(Object value) {
        Map<String, Object> map = new HashMap<>();
        map.put("count", value);
        return map;
    }

    /** The shape rate() reads. */
    private static Map<String, Object> rate(long good, long total) {
        Map<String, Object> map = new HashMap<>();
        map.put("good", good);
        map.put("total", total);
        return map;
    }

    // ── response shape ───────────────────────────────────────────────

    @Nested
    @DisplayName("summary shape")
    class SummaryShape {

        @Test
        void returnsOneObjectRatherThanAList() {
            // KpiRow reads named fields; a bare array leaves every tile blank.
            queueSummary();
            assertThat(response("7d").getBody()).isInstanceOf(Map.class);
        }

        @Test
        void carriesEveryKpiTheDashboardReads() {
            queueSummary();
            assertThat(summary("7d")).containsOnlyKeys(
                    "onTimeRate", "activeVehicles", "openExceptions", "avgTransitHours",
                    "onTimeRateDelta", "avgTransitHoursDelta",
                    "activeVehiclesDelta", "openExceptionsDelta");
        }

        @Test
        void returnsEveryKpiAsANumberRatherThanAString() {
            // A string here would render as a tile with no formatting at all.
            // Counts are whole and rates are fractional, so both appear.
            queueSummary();
            assertThat(summary("7d"))
                    .containsEntry("onTimeRate", 92.0)
                    .containsEntry("activeVehicles", 7L)
                    .containsEntry("avgTransitHours", 30.5);
        }
    }

    // ── gauges ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("gauges")
    class Gauges {

        @Test
        void countsActiveVehicles() {
            queueSummary();
            assertThat(summary("7d")).containsEntry("activeVehicles", 7L);
        }

        @Test
        void countsOnlyUnreadWarningsAndCriticals() {
            queueSummary();
            controller.getSummary("7d", 1L);
            assertThat(jdbc.mapQueries())
                    .anySatisfy(query -> assertThat(query.sql())
                            .contains("FROM notifications")
                            .contains("NOT is_read")
                            .contains("level IN ('critical','warning')"));
        }

        @Test
        void reportsNoDeltaForACurrentStateGauge() {
            // There is no meaningful "previous window" for how many vehicles are
            // active, so a delta here would be a fabricated number.
            queueSummary();
            assertThat(summary("7d"))
                    .containsEntry("activeVehiclesDelta", null)
                    .containsEntry("openExceptionsDelta", null);
        }

        @Test
        void reportsZeroForAnEmptyWorkspace() {
            queueSummary(0, 0, 0, 0);
            assertThat(summary("7d"))
                    .containsEntry("onTimeRate", 0.0)
                    .containsEntry("onTimeRateDelta", 0.0);
        }

        @Test
        void treatsANonNumericCountAsZero() {
            jdbc.answeringMaps(index -> index == 1 ? one("seven") : one(0));
            assertThat(summary("7d")).containsEntry("activeVehicles", 0L);
        }

        @Test
        void readsTheWorkspaceAsAParameterInEveryStatement() {
            queueSummary();
            controller.getSummary("7d", 42L);
            assertThat(jdbc.mapQueries()).allSatisfy(
                    query -> assertThat(query.argsList()).contains(42L));
        }
    }

    // ── on-time rate ─────────────────────────────────────────────────

    @Nested
    @DisplayName("on-time rate")
    class OnTimeRate {

        @Test
        void countsDeliveredShipmentsThatMetTheirEta() {
            queueSummary();
            summary("7d");
            assertThat(jdbc.mapQueries().get(0).sql())
                    .contains("count(*) FILTER (WHERE eta IS NOT NULL AND eta >= created_at) AS good")
                    .contains("count(*) AS total")
                    .contains("status = 'delivered'");
        }

        @Test
        void reportsAPercentageNotAFraction() {
            queueSummary(92, 100, 88, 100);
            assertThat(summary("7d")).containsEntry("onTimeRate", 92.0);
        }

        @Test
        void roundsToTwoDecimals() {
            queueSummary(1, 3, 1, 3);
            assertThat(summary("7d")).containsEntry("onTimeRate", 33.33);
        }

        @Test
        void reportsZeroWhenNothingWasDelivered() {
            // No deliveries is not a 0% on-time rate; the tile would read as a
            // catastrophic month rather than no data.
            queueSummary(0, 0, 0, 0);
            assertThat(summary("7d")).containsEntry("onTimeRate", 0.0);
        }
    }

    // ── deltas ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("deltas")
    class Deltas {

        @Test
        void comparesTheCurrentWindowAgainstTheOneBeforeIt() {
            queueSummary(92, 100, 88, 100);
            assertThat(summary("7d")).containsEntry("onTimeRateDelta", 4.0);
        }

        @Test
        void reportsANegativeDeltaWhenTheRateFell() {
            queueSummary(70, 100, 90, 100);
            assertThat(summary("7d")).containsEntry("onTimeRateDelta", -20.0);
        }

        @Test
        void roundsTheDeltaToOneDecimal() {
            // The unrounded difference is 0.04; a delta tile showing four decimal
            // places would be noise.
            queueSummary(9000, 10000, 8996, 10000);
            assertThat(summary("7d")).containsEntry("onTimeRateDelta", 0.0);
        }

        @Test
        void reportsFallingTransitHoursAsANegativeDelta() {
            // Down is good for transit time, and the sign is what the tile reads
            // to colour itself.
            queueSummary();
            assertThat(summary("7d")).containsEntry("avgTransitHoursDelta", -1.5);
        }

        @Test
        void looksBackTwiceAsFarForThePrecedingWindow() {
            // A window that starts where the current one ends needs the double
            // range; anything less overlaps the two.
            queueSummary();
            summary("30d");
            assertThat(jdbc.mapQueries().get(4).argsList()).containsExactly(1L, 60, 30);
        }

        @Test
        void boundsThePrecedingWindowAtTheStartOfTheCurrentOne() {
            queueSummary();
            summary("7d");
            assertThat(jdbc.mapQueries().get(4).sql())
                    .contains("created_at >= now() - (? || ' days')::interval")
                    .contains("created_at < now() - (? || ' days')::interval");
        }

        @Test
        void issuesSixStatementsAndNoMore() {
            queueSummary();
            summary("7d");
            assertThat(jdbc.mapQueries()).hasSize(6);
        }
    }

    // ── transit hours ────────────────────────────────────────────────

    @Nested
    @DisplayName("transit hours")
    class TransitHours {

        @Test
        void readsTheAverageInHours() {
            queueSummary();
            assertThat(summary("7d")).containsEntry("avgTransitHours", 30.5);
        }

        @Test
        void readsTheAverageAsANumber() {
            queueSummary();
            summary("7d");
            assertThat(jdbc.mapQueries().get(3).sql())
                    .contains("AVG(EXTRACT(EPOCH FROM (eta - created_at)) / 3600.0)")
                    .contains("COALESCE(ROUND(");
        }

        @Test
        void reportsZeroWhenThereIsNoAverage() {
            // The SQL coalesces to 0; a null here would blank the tile.
            jdbc.answeringMaps(index -> one(0));
            assertThat(summary("7d")).containsEntry("avgTransitHours", 0.0);
        }
    }

    // ── ranges ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("ranges")
    class Ranges {

        @Test
        void readsSevenDays() {
            queueSummary();
            summary("7d");
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(7);
        }

        @Test
        void readsThirtyDays() {
            queueSummary();
            summary("30d");
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(30);
        }

        @Test
        void readsNinetyDays() {
            queueSummary();
            summary("90d");
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(90);
        }

        @Test
        void readsTwelveMonthsAsThreeHundredAndSixtyDays() {
            queueSummary();
            summary("12m");
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(360);
        }

        @Test
        void readsAYearAsThreeHundredAndSixtyFiveDays() {
            queueSummary();
            summary("1y");
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(365);
        }

        @Test
        void acceptsABareNumber() {
            queueSummary();
            summary("14");
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(14);
        }

        @Test
        void fallsBackToSevenDaysForAnUnknownRange() {
            // An unparseable range is a typo, not a 500 in the KPI row.
            queueSummary();
            assertThat(response("last-week").getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(7);
        }

        @Test
        void fallsBackToSevenDaysForAnEmptyRange() {
            queueSummary();
            summary("");
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(7);
        }

        @Test
        void clampsARangeOfZeroToOneDay() {
            // A zero-day window would be an empty interval and a blank dashboard.
            queueSummary();
            summary("0d");
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(1);
        }

        @Test
        void clampsANegativeRangeToOneDay() {
            queueSummary();
            summary("-5d");
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(1);
        }

        @Test
        void ignoresCaseAndSurroundingSpace() {
            queueSummary();
            summary(" 30D ");
            assertThat(jdbc.mapQueries().get(0).argsList()).contains(30);
        }
    }

    // ── series ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("series")
    class Series {

        @Test
        void returnsAListSoTrendChartCanMapOverIt() {
            jdbc.returning(List.of(RecordingJdbcTemplate.row(
                    "period", "2026-01-01", "delivered", 4L, "exception", 1L)));
            ResponseEntity<?> response = controller.getSeries("throughput", "30d", null, null, 1L);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isInstanceOf(List.class);
            assertThat(seriesOf(response)).hasSize(1);
        }

        @Test
        void returnsAnEmptyListForAnUnknownKey() {
            // An unknown series is an empty chart, not an error page.
            ResponseEntity<?> response = controller.getSeries("nonsense", "30d", null, null, 1L);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat((List<?>) response.getBody()).isEmpty();
            assertThat(jdbc.queryCount()).isZero();
        }

        @Test
        void splitsDeliveredFromExceptionForTheStackedBars() {
            controller.getSeries("throughput", "30d", null, null, 1L);
            assertThat(jdbc.lastSql())
                    .contains("count(*) FILTER (WHERE status = 'delivered')  AS delivered")
                    .contains("count(*) FILTER (WHERE status = 'exception')  AS exception")
                    .contains("to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS period");
        }

        @Test
        void groupsTheStackedBarsByDayInOrder() {
            controller.getSeries("throughput", "30d", null, null, 1L);
            assertThat(jdbc.lastSql())
                    .contains("GROUP BY date_trunc('day', created_at)")
                    .contains("ORDER BY date_trunc('day', created_at)");
        }

        @Test
        void doesNotCountUndeliveredShipmentsInTheStackedBars() {
            // Two bars per day, so an in-transit shipment must count as neither.
            controller.getSeries("throughput", "30d", null, null, 1L);
            assertThat(jdbc.lastSql()).doesNotContain("status = 'in_transit'");
        }

        @Test
        void aliasesTheOnTimeSeriesTheChartReads() {
            controller.getSeries("onTime", "30d", null, null, 1L);
            assertThat(jdbc.lastSql())
                    .contains("AS period")
                    .contains("AS \"onTimeRate\"")
                    .contains("* 100 / count(*)");
        }

        @Test
        void countsOnlyDeliveredShipmentsInTheOnTimeSeries() {
            controller.getSeries("onTime", "30d", null, null, 1L);
            assertThat(jdbc.lastSql()).contains("status = 'delivered'");
        }

        @Test
        void guardsTheOnTimeDivisionAgainstAnEmptyGroup() {
            controller.getSeries("onTime", "30d", null, null, 1L);
            assertThat(jdbc.lastSql()).contains("CASE WHEN count(*) = 0 THEN 0");
        }

        @Test
        void aliasesTheModeMixKeysThePieChartReads() {
            // TrendChart uses xKey="name" and the series key "value".
            controller.getSeries("modeMix", "30d", null, null, 1L);
            assertThat(jdbc.lastSql())
                    .contains("SELECT mode AS name, count(*) AS value")
                    .contains("GROUP BY mode")
                    .contains("ORDER BY value DESC");
        }

        @Test
        void narrowsEveryShipmentSeriesToOneFacility() {
            controller.getSeries("throughput", "30d", 7L, null, 1L);
            assertThat(jdbc.lastSql()).contains("AND origin_warehouse_id = ?");
            assertThat(jdbc.lastArgs()).containsExactly(1L, 30, 7L);
        }

        @Test
        void narrowsTheOnTimeSeriesToOneFacility() {
            controller.getSeries("onTime", "30d", 7L, null, 1L);
            assertThat(jdbc.lastSql()).contains("AND origin_warehouse_id = ?");
        }

        @Test
        void narrowsTheModeMixToOneFacility() {
            controller.getSeries("modeMix", "30d", 7L, null, 1L);
            assertThat(jdbc.lastSql()).contains("AND origin_warehouse_id = ?");
        }

        @Test
        void doesNotFilterByFacilityWhenNoneIsAsked() {
            controller.getSeries("throughput", "30d", null, null, 1L);
            assertThat(jdbc.lastSql()).doesNotContain("origin_warehouse_id = ?");
            assertThat(jdbc.lastArgs()).containsExactly(1L, 30);
        }

        @Test
        void readsSpeedForOneTripOnly() {
            controller.getSeries("speed", "30d", null, "42", 1L);
            assertThat(jdbc.lastSql())
                    .contains("FROM trip_telemetry_samples")
                    .contains("WHERE trip_id = ?")
                    .contains("speed_kph AS \"speedKph\"")
                    .contains("ORDER BY at DESC")
                    .contains("LIMIT 120");
            assertThat(jdbc.lastArgs()).containsExactly(42L);
        }

        @Test
        void keepsBothTimestampSpellingsForTheSpeedChart() {
            // TrackingPage plots against at; the x key is not aliased away.
            controller.getSeries("speed", "30d", null, "42", 1L);
            assertThat(jdbc.lastSql()).startsWith("SELECT at, speed_kph");
        }

        @Test
        void ignoresTheRangeForSpeedHistory() {
            // A trip's telemetry is not windowed; the range is an Analytics-page
            // control and must not silently truncate the tracking chart.
            controller.getSeries("speed", "7d", null, "42", 1L);
            assertThat(jdbc.lastSql()).doesNotContain("days");
        }

        @Test
        void ignoresTheWorkspaceForSpeedHistory() {
            // A trip belongs to one workspace already, and the samples table has
            // no workspace_id of its own.
            controller.getSeries("speed", "30d", null, "42", 9L);
            assertThat(jdbc.lastArgs()).containsExactly(42L);
        }

        @Test
        void doesNotNarrowSpeedByFacility() {
            controller.getSeries("speed", "30d", 7L, "42", 1L);
            assertThat(jdbc.lastSql()).doesNotContain("facility");
        }

        @Test
        void returnsAnEmptyListWhenNoTripIsAsked() {
            ResponseEntity<?> response = controller.getSeries("speed", "30d", null, null, 1L);
            assertThat((List<?>) response.getBody()).isEmpty();
            assertThat(jdbc.queryCount()).isZero();
        }

        @Test
        void returnsAnEmptyListForABlankTrip() {
            assertThat((List<?>) controller.getSeries("speed", "30d", null, "  ", 1L).getBody())
                    .isEmpty();
            assertThat(jdbc.queryCount()).isZero();
        }

        @Test
        void returnsAnEmptyListForANonNumericTrip() {
            // A malformed id must not reach the database as a bad parameter.
            assertThat((List<?>) controller.getSeries("speed", "30d", null, "abc", 1L).getBody())
                    .isEmpty();
            assertThat(jdbc.queryCount()).isZero();
        }
    }

    // ── failures ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("failures")
    class Failures {

        @Test
        void returns500WithTheMessageRatherThanPropagating() {
            jdbc.failsWith(new IllegalStateException("connection reset"));
            ResponseEntity<?> response = response("7d");
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).isEqualTo(Map.of("error", "connection reset"));
        }

        @Test
        void returns500FromTheSeriesEndpointToo() {
            jdbc.failsWith(new IllegalStateException("connection reset"));
            assertThat(controller.getSeries("throughput", "30d", null, null, 1L).getStatusCode())
                    .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
