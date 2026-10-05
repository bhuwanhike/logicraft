package com.logicraft.notification;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-state writes for notifications.
 *
 * <p>The list side of notifications is served by the generic read endpoint in
 * {@code GenericController}; nothing there can write, so the bell's "Mark all as
 * read" and the per-row toggle on the notifications page had no endpoint to call
 * and were stubbed out in the UI. This is that missing write path.
 *
 * <p>Reads and writes both live under {@code /notifications/**}, which
 * {@code SecurityConfig} already permits and CORS already allows POST to, so no
 * security change accompanies this.
 *
 * <p>Two invariants worth stating, because both are load-bearing for the UI:
 *
 * <ul>
 *   <li>Every statement is scoped by {@code workspace_id}. A notification id is
 *       guessable, and an unscoped {@code UPDATE ... WHERE id = ?} would let one
 *       workspace clear another's inbox.
 *   <li>{@code read_at} is set and cleared together with {@code is_read}. The V8
 *       migration treats a null {@code read_at} on an unread row as the data, so
 *       leaving a stale timestamp behind after un-reading a row would contradict
 *       the schema's own contract.
 * </ul>
 */
@RestController
@RequestMapping("/notifications")
public class NotificationController {

    /**
     * Reads one notification's state back after a write.
     *
     * <p>Returns the row rather than echoing the requested flag, so a client that
     * raced another tab reconciles against the database instead of against its
     * own assumption.
     */
    private static final String READ_STATE = """
        SELECT id, is_read AS "read", read_at AS "readAt"
          FROM notifications
         WHERE id = ? AND workspace_id = ?
        """;

    private final JdbcTemplate jdbcTemplate;

    public NotificationController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Marks one notification read or unread.
     *
     * <p>POST rather than PATCH because the client sends no partial representation
     * — it sends the new read state and nothing else — and because a toggle is
     * naturally idempotent here: re-marking an already-read notification updates
     * the same row and changes nothing.
     */
    @PostMapping("/{id}/read")
    public ResponseEntity<?> markRead(
        @PathVariable Long id,
        @RequestParam(defaultValue = "1") Long workspaceId,
        @RequestBody(required = false) MarkReadRequest request
    ) {
        boolean read = request == null || request.getRead() == null || request.getRead();
        try {
            int updated = jdbcTemplate.update(
                "UPDATE notifications"
                    + "   SET is_read = ?,"
                    + "       read_at = CASE WHEN ? THEN now() ELSE NULL END"
                    + " WHERE id = ? AND workspace_id = ?",
                read, read, id, workspaceId);

            // PostgreSQL counts rows matched, not rows changed, so this is 0 only
            // when no such notification exists in this workspace — not when the
            // row was already in the requested state.
            if (updated == 0) {
                return notFound(id);
            }

            List<Map<String, Object>> rows =
                jdbcTemplate.queryForList(READ_STATE, id, workspaceId);
            if (rows.isEmpty()) {
                return notFound(id);
            }
            return ResponseEntity.ok(rows.get(0));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    /**
     * Marks every unread notification in the workspace as read.
     *
     * <p>The {@code NOT is_read} predicate is what makes this safe to call
     * repeatedly: an already-read notification keeps the {@code read_at} it was
     * first given, so a second call cannot overwrite the original read time with
     * "now". Only the rows that actually change are touched, so the reported
     * count is the number of notifications this call cleared, not the size of the
     * inbox.
     */
    @PostMapping("/mark-all-read")
    public ResponseEntity<?> markAllRead(@RequestParam(defaultValue = "1") Long workspaceId) {
        try {
            int updated = jdbcTemplate.update(
                "UPDATE notifications"
                    + "   SET is_read = TRUE, read_at = now()"
                    + " WHERE workspace_id = ? AND NOT is_read",
                workspaceId);
            return ResponseEntity.ok(Map.of("updated", updated));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    private static ResponseEntity<Map<String, Object>> notFound(Long id) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new LinkedHashMap<>(Map.of(
                "error", "No notification " + id + " in this workspace.",
                "code", "notification-not-found")));
    }

    private static ResponseEntity<Map<String, Object>> serverError(Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", String.valueOf(e.getMessage())));
    }
}