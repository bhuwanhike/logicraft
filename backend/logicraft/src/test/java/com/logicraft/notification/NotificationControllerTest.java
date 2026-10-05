package com.logicraft.notification;

import static org.assertj.core.api.Assertions.assertThat;

import com.logicraft.support.RecordingJdbcTemplate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Tests for the notification read-state endpoints.
 *
 * <p>These are the writes behind the bell's "Mark all as read" and the per-row
 * toggle. Two things are load-bearing and neither is visible in the response
 * body, so both are asserted against the recorded SQL:
 *
 * <ul>
 *   <li>Every statement is scoped by {@code workspace_id}. A notification id is
 *       guessable; an unscoped UPDATE would let one workspace clear another's
 *       inbox.
 *   <li>{@code read_at} moves with {@code is_read}. The V8 migration treats a
 *       null {@code read_at} on an unread row as the data, so un-reading a row
 *       that keeps its old timestamp contradicts the schema's own contract.
 * </ul>
 *
 * <p>RecordingJdbcTemplate records statements and arguments, so these run without
 * a database.
 */
class NotificationControllerTest {

    private RecordingJdbcTemplate jdbc;
    private NotificationController controller;

    @BeforeEach
    void setUp() {
        jdbc = new RecordingJdbcTemplate();
        controller = new NotificationController(jdbc);
    }

    // ── helpers ──────────────────────────────────────────────────────

    private static MarkReadRequest body(Boolean read) {
        MarkReadRequest request = new MarkReadRequest();
        request.setRead(read);
        return request;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> mapBody(ResponseEntity<?> response) {
        return (Map<String, Object>) response.getBody();
    }

    /**
     * The nth write statement, 0-based.
     *
     * <p>Not {@code last()}: a successful toggle issues the UPDATE and then a
     * read-back SELECT, so the last statement is the read-back and its arguments
     * are the id and the workspace. Assertions about the write have to pick the
     * UPDATE out of the recorded list.
     */
    private static RecordingJdbcTemplate.Query nthUpdate(RecordingJdbcTemplate jdbc, int n) {
        List<RecordingJdbcTemplate.Query> updates = jdbc.updateQueries();
        assertThat(updates).hasSizeGreaterThan(n);
        return updates.get(n);
    }

    // ── mark all read ────────────────────────────────────────────────

    @Nested
    @DisplayName("mark all as read")
    class MarkAllRead {

        @Test
        @DisplayName("clears every unread notification in the workspace")
        void clearsUnread() {
            jdbc.updating(7);

            ResponseEntity<?> response = controller.markAllRead(1L);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(mapBody(response)).containsEntry("updated", 7);
            assertThat(jdbc.updateQueries()).hasSize(1);
            assertThat(jdbc.lastSql())
                .contains("UPDATE notifications")
                .contains("is_read = TRUE")
                .contains("read_at = now()");
            assertThat(jdbc.lastArgs()).containsExactly(1L);
        }

        @Test
        @DisplayName("only touches unread rows, so an existing read_at survives")
        void preservesFirstReadTime() {
            controller.markAllRead(1L);

            // Without NOT is_read, a second call would overwrite the timestamp of
            // every notification with "now" and the original read time would be
            // unrecoverable.
            assertThat(jdbc.lastSql()).contains("NOT is_read");
        }

        @Test
        @DisplayName("reports zero rather than failing when nothing is unread")
        void idempotentWhenAlreadyRead() {
            jdbc.updating(0);

            ResponseEntity<?> response = controller.markAllRead(1L);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(mapBody(response)).containsEntry("updated", 0);
        }

        @Test
        @DisplayName("scopes to the requested workspace")
        void scopedToWorkspace() {
            controller.markAllRead(42L);

            assertThat(jdbc.lastSql()).contains("workspace_id = ?");
            assertThat(jdbc.lastArgs()).containsExactly(42L);
        }

        @Test
        @DisplayName("answers 500 with an error body when the write fails")
        void databaseFailure() {
            jdbc.failsWith(new IllegalStateException("connection reset"));

            ResponseEntity<?> response = controller.markAllRead(1L);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(mapBody(response)).containsEntry("error", "connection reset");
        }
    }

    // ── single notification ──────────────────────────────────────────

    @Nested
    @DisplayName("mark one as read")
    class MarkRead {

        @Test
        @DisplayName("sets a read timestamp when marking read")
        void setsReadAt() {
            jdbc.returning(RecordingJdbcTemplate.row(
                "id", 3L, "read", true, "readAt", "2026-10-04T10:00:00Z"));

            ResponseEntity<?> response =
                controller.markRead(3L, 1L, body(Boolean.TRUE));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            // The same flag is bound twice: once for is_read, once for the CASE
            // that decides whether read_at becomes now() or NULL.
            assertThat(nthUpdate(jdbc, 0).argsList())
                .containsExactly(true, true, 3L, 1L);
            assertThat(nthUpdate(jdbc, 0).sql())
                .contains("CASE WHEN ? THEN now() ELSE NULL END");
        }

        @Test
        @DisplayName("clears the read timestamp when marking unread")
        void clearsReadAt() {
            jdbc.returning(RecordingJdbcTemplate.row("id", 3L, "read", false, "readAt", null));

            controller.markRead(3L, 1L, body(Boolean.FALSE));

            assertThat(nthUpdate(jdbc, 0).sql())
                .contains("CASE WHEN ? THEN now() ELSE NULL END");
            assertThat(nthUpdate(jdbc, 0).argsList())
                .containsExactly(false, false, 3L, 1L);
        }

        @Test
        @DisplayName("defaults to marking as read when the body omits it")
        void defaultsToRead() {
            jdbc.returning(RecordingJdbcTemplate.row("id", 3L, "read", true, "readAt", null));

            controller.markRead(3L, 1L, null);
            assertThat(nthUpdate(jdbc, 0).argsList())
                .containsExactly(true, true, 3L, 1L);

            controller.markRead(4L, 1L, body(null));
            assertThat(nthUpdate(jdbc, 1).argsList())
                .containsExactly(true, true, 4L, 1L);
        }

        @Test
        @DisplayName("never reads a notification from another workspace")
        void scopedToWorkspace() {
            controller.markRead(3L, 42L, body(Boolean.TRUE));

            // Both the write and the read-back carry the workspace, so an id from
            // another workspace cannot be updated and cannot leak through the
            // response.
            assertThat(jdbc.queryCount()).isEqualTo(2);
            assertThat(nthUpdate(jdbc, 0).argsList()).containsExactly(true, true, 3L, 42L);
            assertThat(jdbc.lastSql()).contains("workspace_id = ?");
            assertThat(jdbc.lastArgs()).containsExactly(3L, 42L);
        }

        @Test
        @DisplayName("returns the stored state rather than the requested one")
        void returnsStoredState() {
            jdbc.returning(RecordingJdbcTemplate.row(
                "id", 3L, "read", true, "readAt", "2026-10-04T10:00:00Z"));

            Map<String, Object> body = mapBody(controller.markRead(3L, 1L, body(Boolean.TRUE)));

            // So a client that raced another tab reconciles against the database
            // rather than against what it asked for.
            assertThat(body).containsEntry("id", 3L).containsEntry("read", true);
        }

        @Test
        @DisplayName("answers 404 when no such notification exists in the workspace")
        void unknownNotification() {
            jdbc.updating(0);

            ResponseEntity<?> response =
                controller.markRead(999L, 1L, body(Boolean.TRUE));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(mapBody(response))
                .containsEntry("code", "notification-not-found");
            // No read-back: the row does not exist.
            assertThat(jdbc.queryCount()).isEqualTo(1);
        }

        @Test
        @DisplayName("re-marking an already-read notification is not a 404")
        void idempotent() {
            // PostgreSQL counts rows matched, not rows changed, so an update that
            // changes nothing still reports 1.
            jdbc.updating(1)
                .returning(RecordingJdbcTemplate.row("id", 3L, "read", true, "readAt", null));

            ResponseEntity<?> response =
                controller.markRead(3L, 1L, body(Boolean.TRUE));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("answers 500 with an error body when the write fails")
        void databaseFailure() {
            jdbc.failsWith(new IllegalStateException("connection reset"));

            ResponseEntity<?> response =
                controller.markRead(3L, 1L, body(Boolean.TRUE));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(mapBody(response)).containsEntry("error", "connection reset");
        }
    }

    // ── statement hygiene ────────────────────────────────────────────

    @Nested
    @DisplayName("statement safety")
    class StatementSafety {

        @Test
        @DisplayName("binds every value as a parameter, never by concatenation")
        void valuesAreBound() {
            controller.markRead(3L, 1L, body(Boolean.TRUE));

            for (RecordingJdbcTemplate.Query query : jdbc.queries()) {
                assertThat(query.sql()).doesNotContain("3").doesNotContain("42");
            }
        }

        @Test
        @DisplayName("issues exactly one write and one read-back per toggle")
        void statementCount() {
            jdbc.returning(List.of(RecordingJdbcTemplate.row("id", 3L, "read", true, "readAt", null)));

            controller.markRead(3L, 1L, body(Boolean.TRUE));

            assertThat(jdbc.updateQueries()).hasSize(1);
            assertThat(jdbc.listQueries()).hasSize(1);
        }
    }
}