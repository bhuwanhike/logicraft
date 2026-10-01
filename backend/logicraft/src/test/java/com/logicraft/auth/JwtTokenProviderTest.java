package com.logicraft.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.WeakKeyException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for JWT issue and verification.
 *
 * This is the boundary that decides whether a request is authenticated at all,
 * so the interesting cases are the ones that must be refused: a token signed
 * with another key, a token whose payload was edited after signing, a token that
 * has already expired, and a token with no signature at all. Each of those is a
 * way an attacker with no credentials can otherwise mint a valid session.
 *
 * The provider takes its secret as a constructor argument, so these need no
 * Spring context and no properties.
 */
class JwtTokenProviderTest {

    /** 32 bytes minimum for HS256; the configured default is longer. */
    private static final String SECRET = "unit-test-secret-at-least-32-bytes-long!!";
    private static final String OTHER_SECRET = "a-completely-different-secret-32-bytes!!";
    private static final long ONE_DAY_MS = 86_400_000L;

    private JwtTokenProvider provider;

    @BeforeEach
    void setUp() {
        provider = new JwtTokenProvider(SECRET, ONE_DAY_MS);
    }

    // ── round trip ───────────────────────────────────────────────────

    @Nested
    @DisplayName("round trip")
    class RoundTrip {

        @Test
        void readsTheSubjectBackOut() {
            assertThat(provider.getUsernameFromToken(provider.generateToken("ada.lovelace")))
                    .isEqualTo("ada.lovelace");
        }

        @Test
        void validatesAFreshlyIssuedToken() {
            assertThat(provider.validateToken(provider.generateToken("ada.lovelace"))).isTrue();
        }

        @Test
        void signsWithTheConfiguredAlgorithm() {
            // A token that came back "none", or under a weaker algorithm than
            // expected, must not be honoured.
            String header = new String(
                    Base64.getUrlDecoder().decode(provider.generateToken("ada").split("\\.")[0]),
                    StandardCharsets.UTF_8);
            assertThat(header).contains("\"alg\":\"HS256\"");
        }

        @Test
        void setsTheSubjectIssuedAtAndExpiry() {
            Claims claims = parse(provider.generateToken("ada.lovelace"));
            assertThat(claims.getSubject()).isEqualTo("ada.lovelace");
            assertThat(claims.getIssuedAt()).isNotNull();
            assertThat(claims.getExpiration()).isNotNull();
        }

        @Test
        void honoursTheConfiguredLifetime() {
            Claims claims = parse(provider.generateToken("ada"));
            long lifetimeMs = claims.getExpiration().getTime() - claims.getIssuedAt().getTime();
            assertThat(lifetimeMs).isEqualTo(ONE_DAY_MS);
        }

        @Test
        void issuesADifferentTokenForEachUser() {
            // The subject is the only claim that distinguishes two sessions, so
            // it has to be inside the signed payload — which it is.
            assertThat(provider.generateToken("ada")).isNotEqualTo(provider.generateToken("root"));
        }
    }

    // ── refusals ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("refusals")
    class Refusals {

        @Test
        void rejectsATokenSignedWithAnotherKey() {
            // This is the whole point of the signature: a token minted with a
            // key this server does not hold proves nothing.
            String forged = new JwtTokenProvider(OTHER_SECRET, ONE_DAY_MS).generateToken("admin");
            assertThat(provider.validateToken(forged)).isFalse();
        }

        @Test
        void rejectsAnEditedPayload() {
            String[] parts = provider.generateToken("ada.lovelace").split("\\.");
            // Re-sign nothing, only rewrite the subject: the signature no longer
            // covers the claims.
            String forged = parts[0] + "." + encode("{\"sub\":\"root\"}") + "." + parts[2];
            assertThat(provider.validateToken(forged)).isFalse();
        }

        @Test
        void rejectsATamperedSignature() {
            String[] parts = provider.generateToken("ada.lovelace").split("\\.");
            char first = parts[2].charAt(0);
            char flipped = first == 'A' ? 'B' : 'A';
            String forged = parts[0] + "." + parts[1] + "."
                    + flipped + parts[2].substring(1);
            assertThat(provider.validateToken(forged)).isFalse();
        }

        @Test
        void rejectsAnExpiredToken() {
            // Negative lifetime: the token is already past its expiry on issue,
            // which is deterministic where sleeping until a token lapses is not.
            String expired = new JwtTokenProvider(SECRET, -1000L).generateToken("ada");
            assertThat(provider.validateToken(expired)).isFalse();
        }

        @Test
        void rejectsAnUnsignedToken() {
            // The classic "alg: none" downgrade: no key is needed to mint one.
            String unsigned = encode("{\"alg\":\"none\"}")
                    + "." + encode("{\"sub\":\"admin\"}") + ".";
            assertThat(provider.validateToken(unsigned)).isFalse();
        }

        @Test
        void rejectsNull() {
            assertThat(provider.validateToken(null)).isFalse();
        }

        @Test
        void rejectsAnEmptyString() {
            assertThat(provider.validateToken("")).isFalse();
        }

        @Test
        void rejectsSomethingThatIsNotAJwtAtAll() {
            assertThat(provider.validateToken("not-a-token")).isFalse();
        }

        @Test
        void rejectsATokenMissingItsPayload() {
            String[] parts = provider.generateToken("ada").split("\\.");
            assertThat(provider.validateToken(parts[0] + ".")).isFalse();
        }
    }

    // ── reading the subject ──────────────────────────────────────────

    @Nested
    @DisplayName("reading the subject")
    class ReadingTheSubject {

        @Test
        void throwsOnAnExpiredToken() {
            // validateToken is the guard; this documents that the subject is
            // only readable from a token that already passed it.
            String expired = new JwtTokenProvider(SECRET, -1000L).generateToken("ada");
            assertThatThrownBy(() -> provider.getUsernameFromToken(expired))
                    .isInstanceOf(JwtException.class);
        }

        @Test
        void throwsOnATokenSignedWithAnotherKey() {
            String forged = new JwtTokenProvider(OTHER_SECRET, ONE_DAY_MS).generateToken("admin");
            assertThatThrownBy(() -> provider.getUsernameFromToken(forged))
                    .isInstanceOf(JwtException.class);
        }

        @Test
        void throwsOnNull() {
            assertThatThrownBy(() -> provider.getUsernameFromToken(null))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ── key strength ─────────────────────────────────────────────────

    @Nested
    @DisplayName("key strength")
    class KeyStrength {

        @Test
        void refusesASecretTooShortForTheAlgorithm() {
            // HS256 with a 16-byte key is brute-forceable. Failing at startup is
            // the only place this can be caught.
            assertThatThrownBy(() -> new JwtTokenProvider("sixteen-bytes-xxxx", ONE_DAY_MS))
                    .isInstanceOf(WeakKeyException.class);
        }

        @Test
        void acceptsASecretOfExactlyThirtyTwoBytes() {
            assertThat(new JwtTokenProvider("a".repeat(32), ONE_DAY_MS)
                    .validateToken(new JwtTokenProvider("a".repeat(32), ONE_DAY_MS)
                            .generateToken("ada")))
                    .isTrue();
        }
    }

    // ── helpers ──────────────────────────────────────────────────────

    private static String encode(String json) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }

    /** Parses a token with the provider's own key, to inspect its claims. */
    private static Claims parse(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
