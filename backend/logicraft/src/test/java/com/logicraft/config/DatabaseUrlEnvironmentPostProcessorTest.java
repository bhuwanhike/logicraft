package com.logicraft.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/**
 * Tests for the DATABASE_URL fallback.
 *
 * The platforms this targets hand out credentials inside the URL with a
 * {@code postgres://} scheme, which the JDBC driver rejects. Getting the rewrite
 * wrong is worse than not doing it at all, so every shape the URL can take is
 * asserted, as is the promise that it stays out of the way when an operator has
 * configured the database by hand.
 */
class DatabaseUrlEnvironmentPostProcessorTest {

    private final DatabaseUrlEnvironmentPostProcessor processor =
            new DatabaseUrlEnvironmentPostProcessor();

    // ── conversion ───────────────────────────────────────────────────

    @Nested
    @DisplayName("URL conversion")
    class Conversion {

        @Test
        void convertsTheRenderScheme() {
            Map<String, Object> properties = DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties(
                            "postgres://logicraft:secret@dpg-abc123-a:5432/logicraft", null, null);

            assertThat(properties)
                    .containsEntry("spring.datasource.url",
                            "jdbc:postgresql://dpg-abc123-a:5432/logicraft")
                    .containsEntry("spring.datasource.username", "logicraft")
                    .containsEntry("spring.datasource.password", "secret");
        }

        @Test
        void convertsThePostgresqlScheme() {
            Map<String, Object> properties = DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties(
                            "postgresql://logicraft:secret@db.example.com:5432/logicraft", null, null);

            assertThat(properties).containsEntry("spring.datasource.url",
                    "jdbc:postgresql://db.example.com:5432/logicraft");
        }

        @Test
        void omitsThePortWhenTheUrlDoes() {
            Map<String, Object> properties = DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties("postgres://user@db.example.com/logicraft", null, null);

            assertThat(properties).containsEntry("spring.datasource.url",
                    "jdbc:postgresql://db.example.com/logicraft");
        }

        @Test
        void keepsQueryParameters() {
            Map<String, Object> properties = DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties(
                            "postgres://user:secret@db.example.com:5432/logicraft?sslmode=require",
                            null, null);

            assertThat(properties).containsEntry("spring.datasource.url",
                    "jdbc:postgresql://db.example.com:5432/logicraft?sslmode=require");
        }

        @Test
        void passesAReadyJdbcUrlThrough() {
            Map<String, Object> properties = DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties(
                            "jdbc:postgresql://db.example.com:5432/logicraft", null, null);

            assertThat(properties).containsEntry("spring.datasource.url",
                    "jdbc:postgresql://db.example.com:5432/logicraft");
        }

        @Test
        void addsATrailingSlashWhenTheUrlHasNoPath() {
            Map<String, Object> properties = DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties("postgres://user:secret@db.example.com:5432", null, null);

            assertThat(properties).containsEntry("spring.datasource.url",
                    "jdbc:postgresql://db.example.com:5432/");
        }

        @Test
        void decodesPercentEncodedCredentials() {
            Map<String, Object> properties = DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties(
                            "postgres://user:p%40ss@db.example.com:5432/logicraft", null, null);

            assertThat(properties).containsEntry("spring.datasource.password", "p@ss");
        }

        @Test
        void keepsConfiguredCredentialsOverTheOnesInTheUrl() {
            Map<String, Object> properties = DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties(
                            "postgres://url-user:url-pass@db.example.com:5432/logicraft",
                            "configured-user", "configured-pass");

            assertThat(properties)
                    .containsEntry("spring.datasource.url",
                            "jdbc:postgresql://db.example.com:5432/logicraft")
                    .doesNotContainKeys("spring.datasource.username", "spring.datasource.password");
        }

        @Test
        void ignoresAUrlItCannotUnderstand() {
            assertThat(DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties("not a url", null, null)).isEmpty();
            assertThat(DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties("mysql://user:pass@host/db", null, null)).isEmpty();
            assertThat(DatabaseUrlEnvironmentPostProcessor
                    .toDataSourceProperties("postgres:///no-host", null, null)).isEmpty();
        }
    }

    // ── environment wiring ───────────────────────────────────────────

    @Nested
    @DisplayName("environment wiring")
    class Wiring {

        @Test
        void overridesTheLocalhostDefaultWhenOnlyDatabaseUrlIsSet() {
            MockEnvironment environment = new MockEnvironment()
                    .withProperty("DATABASE_URL",
                            "postgres://user:secret@dpg-abc-a:5432/logicraft")
                    // Stands in for the value application.yml supplies.
                    .withProperty("spring.datasource.url",
                            "jdbc:postgresql://localhost:5432/logicraft");

            processor.postProcessEnvironment(environment, null);

            assertThat(environment.getProperty("spring.datasource.url"))
                    .isEqualTo("jdbc:postgresql://dpg-abc-a:5432/logicraft");
            assertThat(environment.getProperty("spring.datasource.username")).isEqualTo("user");
            assertThat(environment.getProperty("spring.datasource.password")).isEqualTo("secret");
        }

        @Test
        void doesNothingWithoutDatabaseUrl() {
            MockEnvironment environment = new MockEnvironment()
                    .withProperty("spring.datasource.url",
                            "jdbc:postgresql://localhost:5432/logicraft");

            processor.postProcessEnvironment(environment, null);

            assertThat(environment.getProperty("spring.datasource.url"))
                    .isEqualTo("jdbc:postgresql://localhost:5432/logicraft");
            assertThat(environment.getPropertySources().get(DatabaseUrlEnvironmentPostProcessor.PROPERTY_SOURCE_NAME))
                    .isNull();
        }

        @Test
        void doesNotOverrideAnExplicitDbUrl() {
            MockEnvironment environment = new MockEnvironment()
                    .withProperty("DB_URL", "jdbc:postgresql://custom:5432/logicraft")
                    .withProperty("DATABASE_URL", "postgres://user:secret@dpg-abc-a:5432/logicraft");

            processor.postProcessEnvironment(environment, null);

            assertThat(environment.getPropertySources().get(DatabaseUrlEnvironmentPostProcessor.PROPERTY_SOURCE_NAME))
                    .isNull();
        }

        @Test
        void doesNotOverrideExplicitDbHost() {
            MockEnvironment environment = new MockEnvironment()
                    .withProperty("DB_HOST", "custom.example.com")
                    .withProperty("DATABASE_URL", "postgres://user:secret@dpg-abc-a:5432/logicraft");

            processor.postProcessEnvironment(environment, null);

            assertThat(environment.getPropertySources().get(DatabaseUrlEnvironmentPostProcessor.PROPERTY_SOURCE_NAME))
                    .isNull();
        }
    }
}
