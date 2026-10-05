package com.logicraft.notification;

import lombok.Data;

/**
 * Body for the single-notification read toggle.
 *
 * <p>{@code read} is a boxed Boolean rather than a primitive so an absent field
 * can be told from an explicit {@code false}. The toggle has to move a
 * notification both ways, and collapsing "not supplied" into {@code false} would
 * make a client that omits the field silently mark a notification unread.
 */
@Data
public class MarkReadRequest {

    /** {@code null} means "mark as read", which is what the endpoint name implies. */
    private Boolean read;
}