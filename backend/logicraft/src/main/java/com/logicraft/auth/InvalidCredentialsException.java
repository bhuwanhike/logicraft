package com.logicraft.auth;

/**
 * Raised for an unknown account, a wrong password, or an account that is not
 * active. The message is deliberately the same in every case so the response
 * cannot be used to discover which emails have accounts.
 */
public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException(String message) {
        super(message);
    }
}
