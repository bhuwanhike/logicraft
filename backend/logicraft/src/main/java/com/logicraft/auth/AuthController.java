package com.logicraft.auth;

import com.logicraft.auth.dto.LoginRequest;
import com.logicraft.auth.dto.SignupRequest;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Signup and login endpoints.
 *
 * Both are public (see SecurityConfig), and both answer failures with the same
 * `{ error, code }` shape the workspace client already parses, so the form can
 * tell "that account exists" from "those details are wrong" without reading the
 * message text.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(authService.signUp(request));
        } catch (DuplicateEmailException e) {
            return error(HttpStatus.CONFLICT, "duplicate-email", e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            return ResponseEntity.ok(authService.signIn(request));
        } catch (InvalidCredentialsException e) {
            return error(HttpStatus.UNAUTHORIZED, "invalid-credentials", e.getMessage());
        }
    }

    private static ResponseEntity<Map<String, String>> error(
            HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "code", code));
    }
}
