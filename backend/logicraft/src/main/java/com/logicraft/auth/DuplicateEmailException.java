package com.logicraft.auth;

/** Raised when signup is attempted for an email that already has an account. */
public class DuplicateEmailException extends RuntimeException {
    public DuplicateEmailException(String message) {
        super(message);
    }
}
