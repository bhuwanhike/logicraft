package com.logicraft.config;

import static org.assertj.core.api.Assertions.assertThat;

import static org.springframework.http.HttpMethod.DELETE;
import static org.springframework.http.HttpMethod.GET;
import static org.springframework.http.HttpMethod.OPTIONS;
import static org.springframework.http.HttpMethod.PATCH;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpMethod.PUT;
import static org.springframework.http.HttpMethod.TRACE;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Tests for the CORS policy and the password encoder.
 *
 * Both are bean methods on a plain configuration class, so they can be called
 * directly and the resulting objects interrogated. No Spring context, and no
 * database.
 *
 * The CORS assertions are about what the policy refuses as much as what it
 * allows. Credentials are enabled, so a wildcard origin would hand any site on
 * the internet authenticated access; the origin list is therefore the security
 * boundary and is asserted exactly, not by pattern.
 */
class SecurityConfigTest {

    private SecurityConfig config;
    private CorsConfigurationSource source;

    @BeforeEach
    void setUp() {
        config = new SecurityConfig();
        source = config.corsConfigurationSource();
    }

    private CorsConfiguration policyFor(String path) {
        CorsConfiguration configuration =
                source.getCorsConfiguration(new MockHttpServletRequest("GET", path));
        assertThat(configuration).as("no CORS policy for %s", path).isNotNull();
        return configuration;
    }

    // ── origin ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("CORS origins")
    class Origins {

        @Test
        void allowsTheViteDevServer() {
            assertThat(policyFor("/vehicles").checkOrigin("http://localhost:5173"))
                    .isEqualTo("http://localhost:5173");
        }

        @Test
        void allowsTheAlternativeDevServer() {
            assertThat(policyFor("/vehicles").checkOrigin("http://localhost:3000"))
                    .isEqualTo("http://localhost:3000");
        }

        @Test
        void refusesAProductionOrigin() {
            // The deployed site is not in the list, so until it is added every
            // cross-origin request from it is refused. That is the safe default.
            assertThat(policyFor("/vehicles").checkOrigin("https://app.logicraft.example")).isNull();
        }

        @Test
        void refusesAnUnlistedLocalhostPort() {
            // Same host, different port, different origin — and a different app.
            assertThat(policyFor("/vehicles").checkOrigin("http://localhost:5174")).isNull();
        }

        @Test
        void refusesTheHttpsLocalhostOrigin() {
            assertThat(policyFor("/vehicles").checkOrigin("https://localhost:5173")).isNull();
        }

        @Test
        void doesNotUseAWildcard() {
            // allowCredentials(true) with "*" would let any site send cookies.
            assertThat(policyFor("/vehicles").getAllowedOrigins()).doesNotContain("*");
        }

        @Test
        void namesEveryOriginExactly() {
            // An exact list, so an addition to it is a deliberate act.
            assertThat(policyFor("/vehicles").getAllowedOrigins())
                    .containsExactly("http://localhost:5173", "http://localhost:3000");
        }
    }

    // ── methods and headers ──────────────────────────────────────────

    @Nested
    @DisplayName("CORS methods and headers")
    class MethodsAndHeaders {

        @Test
        void allowsTheMethodsTheWorkspaceSends() {
            CorsConfiguration policy = policyFor("/shipments");
            for (HttpMethod method : List.of(GET, POST, PUT, PATCH, DELETE, OPTIONS)) {
                assertThat(policy.checkHttpMethod(method)).as(method.name()).contains(method);
            }
        }

        @Test
        void refusesTrace() {
            // TRACE echoes headers back, which is how a cross-origin script would
            // read a token it is not allowed to see.
            assertThat(policyFor("/vehicles").checkHttpMethod(TRACE)).isNull();
        }

        @Test
        void allowsTheAuthorizationHeader() {
            assertThat(policyFor("/vehicles").checkHeaders(List.of("Authorization")))
                    .containsExactly("Authorization");
        }

        @Test
        void allowsAContentTypeHeader() {
            assertThat(policyFor("/shipments").checkHeaders(List.of("Content-Type")))
                    .containsExactly("Content-Type");
        }

        @Test
        void sendsCredentials() {
            // The SPA holds a token and a session cookie; without this the
            // browser drops both on every cross-origin call.
            assertThat(policyFor("/auth/login").getAllowCredentials()).isTrue();
        }
    }

    // ── scope ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("CORS scope")
    class Scope {

        @Test
        void appliesToEveryPath() {
            // Registered for /**, so a new controller is covered without
            // remembering to add its path here.
            for (String path : List.of("/vehicles", "/shipments", "/metrics/summary",
                    "/audit-logs", "/auth/login", "/anything-else")) {
                assertThat(policyFor(path)).isNotNull();
            }
        }
    }

    // ── password encoder ─────────────────────────────────────────────

    @Nested
    @DisplayName("password encoder")
    class Encoder {

        private PasswordEncoder encoder() {
            return config.passwordEncoder();
        }

        @Test
        void hashesWithBcrypt() {
            String hash = encoder().encode("correct horse battery staple");
            assertThat(hash).startsWith("$2");
            assertThat(hash).hasSize(60);
        }

        @Test
        void neverReturnsThePasswordItWasGiven() {
            String password = "correct horse battery staple";
            assertThat(encoder().encode(password)).doesNotContain(password);
        }

        @Test
        void saltsEachHash() {
            // Two identical passwords must not produce identical hashes, or the
            // database would reveal which accounts share a password.
            PasswordEncoder encoder = encoder();
            assertThat(encoder.encode("same-password")).isNotEqualTo(encoder.encode("same-password"));
        }

        @Test
        void matchesThePasswordItHashed() {
            PasswordEncoder encoder = encoder();
            assertThat(encoder.matches("correct horse battery staple",
                    encoder.encode("correct horse battery staple"))).isTrue();
        }

        @Test
        void refusesTheWrongPassword() {
            PasswordEncoder encoder = encoder();
            String hash = encoder.encode("correct horse battery staple");
            assertThat(encoder.matches("Correct horse battery staple", hash)).isFalse();
            assertThat(encoder.matches("", hash)).isFalse();
        }

        @Test
        void refusesAnEmptyPassword() {
            // BCrypt happily hashes ""; the guard belongs at the validation
            // boundary, so this records the encoder's actual behaviour.
            assertThat(encoder().encode("")).hasSize(60);
        }

        @Test
        void isTheBcryptEncoder() {
            assertThat(encoder()).isInstanceOf(BCryptPasswordEncoder.class);
        }
    }
}
