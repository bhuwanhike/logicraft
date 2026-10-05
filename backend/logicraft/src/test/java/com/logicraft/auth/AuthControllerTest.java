package com.logicraft.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.logicraft.auth.dto.AuthResponse;
import com.logicraft.auth.dto.LoginRequest;
import com.logicraft.auth.dto.SignupRequest;
import com.logicraft.support.RecordingJdbcTemplate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Tests for signup and login.
 *
 * Two things are being protected here. The first is the account contract: an
 * email is unique and case-insensitive, a password is only ever stored as a
 * bcrypt digest, and a role label from the form resolves to a ROLE_* name that
 * exists in the database. The second is the login boundary: a wrong password,
 * an unknown email and a deactivated account must all be indistinguishable from
 * the outside, because the difference is what tells an attacker which addresses
 * are real.
 *
 * RecordingJdbcTemplate records the statements, so these assert the SQL and the
 * bound arguments without a database.
 */
class AuthControllerTest {

    private static final String SECRET = "unit-test-secret-at-least-32-bytes-long!!";
    private static final long ONE_DAY_MS = 86_400_000L;

    private RecordingJdbcTemplate jdbc;
    private PasswordEncoder encoder;
    private JwtTokenProvider tokens;
    private AuthController controller;

    @BeforeEach
    void setUp() {
        jdbc = new RecordingJdbcTemplate();
        encoder = new BCryptPasswordEncoder();
        tokens = new JwtTokenProvider(SECRET, ONE_DAY_MS);
        controller = new AuthController(new AuthService(jdbc, encoder, tokens));
    }

    // ── helpers ──────────────────────────────────────────────────────

    private static SignupRequest signup(
            String name, String email, String company, String role, String password) {
        SignupRequest request = new SignupRequest();
        request.setName(name);
        request.setEmail(email);
        request.setCompany(company);
        request.setRole(role);
        request.setPassword(password);
        return request;
    }

    private static LoginRequest login(String email, String password) {
        LoginRequest request = new LoginRequest();
        request.setEmail(email);
        request.setPassword(password);
        return request;
    }

    private static AuthResponse body(ResponseEntity<?> response) {
        return (AuthResponse) response.getBody();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> errorBody(ResponseEntity<?> response) {
        return (Map<String, Object>) response.getBody();
    }

    private static Map<String, Object> userRow(
            long id, String username, String email, String hash, boolean active, String role) {
        return RecordingJdbcTemplate.row(
            "id", id, "username", username, "email", email,
            "name", "Ada Lovelace", "company", "Analytical Engines",
            "passwordHash", hash, "active", active, "role", role);
    }

    // ── signup ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("signup")
    class Signup {

        @Test
        void createsTheAccountAndReturnsASession() {
            // count(email), count(username), INSERT ... RETURNING id, SELECT role id
            jdbc.answeringScalars(i -> List.of(0L, 0L, 42L, 7L).get(i));

            ResponseEntity<?> response = controller.signup(
                signup("Ada Lovelace", "ada@example.com", "Analytical Engines",
                    "Operations Manager", "correct-horse"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            AuthResponse session = body(response);
            assertThat(session.getId()).isEqualTo("42");
            assertThat(session.getUsername()).isEqualTo("ada");
            assertThat(session.getEmail()).isEqualTo("ada@example.com");
            assertThat(session.getName()).isEqualTo("Ada Lovelace");
            assertThat(session.getCompany()).isEqualTo("Analytical Engines");
            assertThat(session.getRole()).isEqualTo("Operations Manager");
            assertThat(session.getTokenType()).isEqualTo("Bearer");
            assertThat(session.getToken()).isNotBlank();
            assertThat(tokens.getUsernameFromToken(session.getToken())).isEqualTo("ada");
        }

        @Test
        void lowercasesAndTrimsTheEmail() {
            jdbc.answeringScalars(i -> List.of(0L, 0L, 42L, 7L).get(i));

            controller.signup(
                signup("Ada", "  Ada@Example.COM  ", "Engines", "Data Analyst", "correct-horse"));

            List<Object> args = jdbc.objectQueries().stream()
                .filter(q -> q.sql().contains("INSERT INTO users"))
                .findFirst()
                .orElseThrow()
                .argsList();
            assertThat(args).contains("ada@example.com");
        }

        @Test
        void rejectsAnEmailThatAlreadyHasAnAccount() {
            jdbc.answeringScalars(i -> List.of(1L).get(i));

            ResponseEntity<?> response = controller.signup(
                signup("Ada", "ada@example.com", "Engines", "Data Analyst", "correct-horse"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(errorBody(response)).containsEntry("code", "duplicate-email");
            assertThat(jdbc.queries()).noneMatch(q -> q.sql().contains("INSERT INTO users"));
        }

        @Test
        void storesABcryptDigestAndNeverThePlaintextPassword() {
            jdbc.answeringScalars(i -> List.of(0L, 0L, 42L, 7L).get(i));

            controller.signup(
                signup("Ada", "ada@example.com", "Engines", "Data Analyst", "correct-horse"));

            List<Object> args = jdbc.objectQueries().stream()
                .filter(q -> q.sql().contains("INSERT INTO users"))
                .findFirst()
                .orElseThrow()
                .argsList();
            assertThat(args).doesNotContain("correct-horse");
            String hash = args.stream()
                .map(String::valueOf)
                .filter(value -> value.startsWith("$2"))
                .findFirst()
                .orElseThrow();
            assertThat(encoder.matches("correct-horse", hash)).isTrue();
        }

        @Test
        void assignsTheRequestedRole() {
            jdbc.answeringScalars(i -> List.of(0L, 0L, 42L, 7L).get(i));

            ResponseEntity<?> response = controller.signup(
                signup("Ada", "ada@example.com", "Engines", "Fleet Supervisor", "correct-horse"));

            RecordingJdbcTemplate.Query roleLookup = jdbc.objectQueries().stream()
                .filter(q -> q.sql().contains("FROM roles"))
                .findFirst()
                .orElseThrow();
            assertThat(roleLookup.argsList()).containsExactly("ROLE_FLEET_MANAGER");
            assertThat(body(response).getRole()).isEqualTo("Fleet Supervisor");
        }

        @Test
        void mapsEveryRoleOfferedByTheSignupForm() {
            Map<String, String> expected = Map.of(
                "Operations Manager", "ROLE_ORG_ADMIN",
                "Dispatcher", "ROLE_DISPATCHER",
                "Fleet Supervisor", "ROLE_FLEET_MANAGER",
                "Warehouse Lead", "ROLE_WAREHOUSE_MANAGER",
                "Data Analyst", "ROLE_ANALYST");

            for (Map.Entry<String, String> entry : expected.entrySet()) {
                RecordingJdbcTemplate scoped = new RecordingJdbcTemplate();
                scoped.answeringScalars(i -> List.of(0L, 0L, 42L, 7L).get(i));
                AuthController scopedController = new AuthController(
                    new AuthService(scoped, encoder, tokens));

                scopedController.signup(
                    signup("Ada", "ada@example.com", "Engines", entry.getKey(), "correct-horse"));

                assertThat(scoped.objectQueries())
                    .filteredOn(q -> q.sql().contains("FROM roles"))
                    .singleElement()
                    .satisfies(q -> assertThat(q.argsList()).containsExactly(entry.getValue()));
            }
        }

        @Test
        void fallsBackToTheViewerRoleForAnUnrecognisedLabel() {
            jdbc.answeringScalars(i -> List.of(0L, 0L, 42L, 7L).get(i));

            ResponseEntity<?> response = controller.signup(
                signup("Ada", "ada@example.com", "Engines", "Chief Wizard", "correct-horse"));

            assertThat(body(response).getRole()).isEqualTo("Viewer");
            RecordingJdbcTemplate.Query roleLookup = jdbc.objectQueries().stream()
                .filter(q -> q.sql().contains("FROM roles"))
                .findFirst()
                .orElseThrow();
            assertThat(roleLookup.argsList()).containsExactly("ROLE_VIEWER");
        }

        @Test
        void assignsTheRoleToTheNewUser() {
            jdbc.answeringScalars(i -> List.of(0L, 0L, 42L, 7L).get(i));

            controller.signup(
                signup("Ada", "ada@example.com", "Engines", "Data Analyst", "correct-horse"));

            RecordingJdbcTemplate.Query assignment = jdbc.updateQueries().stream()
                .filter(q -> q.sql().contains("INSERT INTO user_roles"))
                .findFirst()
                .orElseThrow();
            assertThat(assignment.argsList()).containsExactly(42L, 7L);
        }

        @Test
        void appendsASuffixWhenTheUsernameIsAlreadyTaken() {
            // count(email)=0, count('ada')=1, count('ada2')=0, insert id, role id
            jdbc.answeringScalars(i -> List.of(0L, 1L, 0L, 42L, 7L).get(i));

            ResponseEntity<?> response = controller.signup(
                signup("Ada", "ada@example.com", "Engines", "Data Analyst", "correct-horse"));

            assertThat(body(response).getUsername()).isEqualTo("ada2");
        }

        @Test
        void recordsTheAccountAsActiveInTheDefaultWorkspace() {
            jdbc.answeringScalars(i -> List.of(0L, 0L, 42L, 7L).get(i));

            controller.signup(
                signup("Ada", "ada@example.com", "Engines", "Data Analyst", "correct-horse"));

            String insert = jdbc.objectQueries().stream()
                .map(RecordingJdbcTemplate.Query::sql)
                .filter(sql -> sql.contains("INSERT INTO users"))
                .findFirst()
                .orElseThrow();
            assertThat(insert).contains("'active'").contains("workspace_id");
        }

        @Test
        void splitsTheFullNameIntoFirstAndLastName() {
            jdbc.answeringScalars(i -> List.of(0L, 0L, 42L, 7L).get(i));

            controller.signup(
                signup("Ada King Lovelace", "ada@example.com", "Engines",
                    "Data Analyst", "correct-horse"));

            List<Object> args = jdbc.objectQueries().stream()
                .filter(q -> q.sql().contains("INSERT INTO users"))
                .findFirst()
                .orElseThrow()
                .argsList();
            assertThat(args).contains("Ada", "King Lovelace", "Ada King Lovelace");
        }
    }

    // ── login ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("login")
    class Login {

        @Test
        void returnsASessionForValidCredentials() {
            jdbc.returning(userRow(1L, "ada", "ada@example.com",
                encoder.encode("correct-horse"), true, "ROLE_ORG_ADMIN"));

            ResponseEntity<?> response = controller.login(login("ada@example.com", "correct-horse"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            AuthResponse session = body(response);
            assertThat(session.getId()).isEqualTo("1");
            assertThat(session.getUsername()).isEqualTo("ada");
            assertThat(session.getRole()).isEqualTo("Operations Manager");
            assertThat(tokens.getUsernameFromToken(session.getToken())).isEqualTo("ada");
        }

        @Test
        void looksUpCaseInsensitively() {
            jdbc.returning(userRow(1L, "ada", "ada@example.com",
                encoder.encode("correct-horse"), true, "ROLE_ORG_ADMIN"));

            controller.login(login("  Ada@Example.COM  ", "correct-horse"));

            RecordingJdbcTemplate.Query lookup = jdbc.listQueries().get(0);
            assertThat(lookup.argsList()).containsExactly("ada@example.com", "ada@example.com");
        }

        @Test
        void touchesLastActiveOnSuccess() {
            jdbc.returning(userRow(7L, "ada", "ada@example.com",
                encoder.encode("correct-horse"), true, "ROLE_ORG_ADMIN"));

            controller.login(login("ada@example.com", "correct-horse"));

            RecordingJdbcTemplate.Query update = jdbc.updateQueries().stream()
                .filter(q -> q.sql().contains("last_active_at"))
                .findFirst()
                .orElseThrow();
            assertThat(update.argsList()).containsExactly(7L);
        }

        @Test
        void reportsATeamMemberWhenTheAccountHasNoRole() {
            jdbc.returning(userRow(1L, "ada", "ada@example.com",
                encoder.encode("correct-horse"), true, null));

            ResponseEntity<?> response = controller.login(login("ada@example.com", "correct-horse"));

            assertThat(body(response).getRole()).isEqualTo("Team member");
        }

        @Test
        void rejectsAnUnknownEmail() {
            jdbc.returning(List.of());

            ResponseEntity<?> response = controller.login(login("nobody@example.com", "correct-horse"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(errorBody(response)).containsEntry("code", "invalid-credentials");
        }

        @Test
        void rejectsAWrongPassword() {
            jdbc.returning(userRow(1L, "ada", "ada@example.com",
                encoder.encode("correct-horse"), true, "ROLE_ORG_ADMIN"));

            ResponseEntity<?> response = controller.login(login("ada@example.com", "wrong-horse"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(errorBody(response)).containsEntry("code", "invalid-credentials");
        }

        @Test
        void rejectsADeactivatedAccount() {
            jdbc.returning(userRow(1L, "ada", "ada@example.com",
                encoder.encode("correct-horse"), false, "ROLE_ORG_ADMIN"));

            ResponseEntity<?> response = controller.login(login("ada@example.com", "correct-horse"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        void doesNotTouchLastActiveForARejectedLogin() {
            jdbc.returning(userRow(1L, "ada", "ada@example.com",
                encoder.encode("correct-horse"), true, "ROLE_ORG_ADMIN"));

            controller.login(login("ada@example.com", "wrong-horse"));

            assertThat(jdbc.updateQueries()).isEmpty();
        }

        @Test
        void givesTheSameMessageForUnknownWrongAndDeactivated() {
            jdbc.returning(List.of());
            String unknown = errorBody(controller.login(login("nobody@example.com", "x"))).get("error").toString();

            jdbc.returning(userRow(1L, "ada", "ada@example.com",
                encoder.encode("correct-horse"), true, "ROLE_ORG_ADMIN"));
            String wrong = errorBody(controller.login(login("ada@example.com", "wrong"))).get("error").toString();

            jdbc.returning(userRow(1L, "ada", "ada@example.com",
                encoder.encode("correct-horse"), false, "ROLE_ORG_ADMIN"));
            String inactive = errorBody(controller.login(login("ada@example.com", "correct-horse"))).get("error").toString();

            assertThat(unknown).isEqualTo(wrong).isEqualTo(inactive);
        }
    }
}
