package com.logicraft.auth;

import com.logicraft.auth.dto.AuthResponse;
import com.logicraft.auth.dto.LoginRequest;
import com.logicraft.auth.dto.SignupRequest;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Signup and login against the users/roles tables.
 *
 * Written on JdbcTemplate rather than a JPA repository to match
 * {@link com.logicraft.common.GenericController}: the users table is read here
 * with the same quoted-alias projections the workspace uses, and a signup is a
 * handful of statements that are clearer as SQL than as an entity graph.
 */
@Service
public class AuthService {

    /**
     * The roles the signup form offers, mapped to the ROLE_* names in the
     * database. An unrecognised label falls back to the least-privileged role
     * rather than failing the request.
     */
    private static final Map<String, String> ROLE_BY_LABEL = Map.of(
        "Operations Manager", "ROLE_ORG_ADMIN",
        "Dispatcher", "ROLE_DISPATCHER",
        "Fleet Supervisor", "ROLE_FLEET_MANAGER",
        "Warehouse Lead", "ROLE_WAREHOUSE_MANAGER",
        "Data Analyst", "ROLE_ANALYST"
    );

    /** The inverse of {@link #ROLE_BY_LABEL}, plus the roles seeded but not offered. */
    private static final Map<String, String> LABEL_BY_ROLE = Map.ofEntries(
        Map.entry("ROLE_SUPER_ADMIN", "Platform Administrator"),
        Map.entry("ROLE_ORG_ADMIN", "Operations Manager"),
        Map.entry("ROLE_FLEET_MANAGER", "Fleet Supervisor"),
        Map.entry("ROLE_DISPATCHER", "Dispatcher"),
        Map.entry("ROLE_WAREHOUSE_MANAGER", "Warehouse Lead"),
        Map.entry("ROLE_WAREHOUSE_STAFF", "Warehouse Associate"),
        Map.entry("ROLE_ANALYST", "Data Analyst"),
        Map.entry("ROLE_VIEWER", "Viewer"),
        Map.entry("ROLE_DRIVER", "Driver"),
        Map.entry("ROLE_CUSTOMER", "Customer")
    );

    private static final String SIGNIN_SQL = """
        SELECT u.id,
               u.username,
               u.email,
               u.name,
               u.company,
               u.password_hash AS "passwordHash",
               u.is_active     AS "active",
               (SELECT r.name
                  FROM user_roles ur
                  JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id
                 ORDER BY r.rank
                 LIMIT 1) AS "role"
          FROM users u
         WHERE lower(u.email) = ? OR lower(u.username) = ?
         LIMIT 1
        """;

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthService(
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider tokenProvider) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    /** Creates an account, assigns its role, and returns a signed-in session. */
    @Transactional
    public AuthResponse signUp(SignupRequest request) {
        String email = normalise(request.getEmail());
        String name = request.getName().trim();
        String company = request.getCompany().trim();

        Long existing = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM users WHERE lower(email) = ?", Long.class, email);
        if (existing != null && existing > 0) {
            throw new DuplicateEmailException("An account with that email already exists.");
        }

        String username = uniqueUsername(email);
        String requestedRole = request.getRole() == null ? "" : request.getRole();
        String roleName = ROLE_BY_LABEL.getOrDefault(requestedRole, "ROLE_VIEWER");
        String roleLabel = LABEL_BY_ROLE.getOrDefault(roleName, "Viewer");
        String[] parts = splitName(name);
        String passwordHash = passwordEncoder.encode(request.getPassword());

        Long userId = jdbcTemplate.queryForObject("""
            INSERT INTO users
                (username, email, password_hash, first_name, last_name, name, company,
                 status, is_active, workspace_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', true, 1, now(), now())
            RETURNING id
            """, Long.class,
            username, email, passwordHash, parts[0], parts[1], name, company);

        Long roleId = jdbcTemplate.queryForObject(
            "SELECT id FROM roles WHERE name = ?", Long.class, roleName);
        if (roleId != null) {
            jdbcTemplate.update(
                "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                userId, roleId);
        }

        return response(userId, username, email, name, company, roleLabel);
    }

    /** Verifies credentials and returns a session, or throws for any mismatch. */
    public AuthResponse signIn(LoginRequest request) {
        String key = normalise(request.getEmail());
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(SIGNIN_SQL, key, key);
        if (rows.isEmpty()) {
            throw invalidCredentials();
        }

        Map<String, Object> row = rows.get(0);
        boolean active = Boolean.TRUE.equals(row.get("active"));
        Object stored = row.get("passwordHash");
        String passwordHash = stored == null ? "" : String.valueOf(stored);
        if (!active || !passwordEncoder.matches(request.getPassword(), passwordHash)) {
            throw invalidCredentials();
        }

        Long userId = ((Number) row.get("id")).longValue();
        String username = String.valueOf(row.get("username"));
        String email = String.valueOf(row.get("email"));
        String name = row.get("name") == null ? "" : String.valueOf(row.get("name"));
        String company = row.get("company") == null ? "" : String.valueOf(row.get("company"));
        String roleName = row.get("role") == null ? null : String.valueOf(row.get("role"));

        jdbcTemplate.update("UPDATE users SET last_active_at = now() WHERE id = ?", userId);

        String role = roleName == null
            ? "Team member"
            : LABEL_BY_ROLE.getOrDefault(roleName, "Team member");
        return response(userId, username, email, name, company, role);
    }

    private AuthResponse response(
            Long id, String username, String email, String name, String company, String role) {
        return AuthResponse.builder()
            .token(tokenProvider.generateToken(username))
            .tokenType("Bearer")
            .id(String.valueOf(id))
            .username(username)
            .email(email)
            .name(name)
            .company(company)
            .role(role)
            .build();
    }

    private static InvalidCredentialsException invalidCredentials() {
        return new InvalidCredentialsException(
            "That email and password combination does not match an account.");
    }

    private static String normalise(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    /** The email's local part, reduced to characters the username column allows. */
    private String uniqueUsername(String email) {
        int at = email.indexOf('@');
        String base = (at > 0 ? email.substring(0, at) : email).replaceAll("[^a-z0-9._-]", "");
        if (base.isBlank()) {
            base = "user";
        }
        if (base.length() > 40) {
            base = base.substring(0, 40);
        }
        String candidate = base;
        int suffix = 1;
        while (usernameTaken(candidate)) {
            String tail = String.valueOf(++suffix);
            candidate = base.substring(0, Math.min(base.length(), 49 - tail.length())) + tail;
        }
        return candidate;
    }

    private boolean usernameTaken(String username) {
        Long count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM users WHERE username = ?", Long.class, username);
        return count != null && count > 0;
    }

    private static String[] splitName(String name) {
        int space = name.indexOf(' ');
        String first = space < 0 ? name : name.substring(0, space);
        String last = space < 0 ? "" : name.substring(space + 1).trim();
        // first_name/last_name are VARCHAR(50); the full name column holds the
        // untruncated value for display.
        return new String[] { clip(first, 50), clip(last, 50) };
    }

    private static String clip(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
