package com.logicraft.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;

/**
 * Lets a single {@code DATABASE_URL} stand in for the individual {@code DB_*}
 * settings.
 *
 * Render, Railway and Heroku inject a linked database as one variable,
 * {@code DATABASE_URL}, whose value looks like
 * {@code postgres://user:pass@host:5432/dbname}. The PostgreSQL JDBC driver
 * cannot use that: it needs the {@code jdbc:postgresql://} scheme and it does
 * not read credentials out of the authority, so a deployment that only links a
 * database would otherwise fall back to {@code localhost} and fail with
 * "Connection refused".
 *
 * This runs during environment preparation, before the datasource is bound, and
 * rewrites the URL into {@code spring.datasource.url}, moving any credentials
 * into {@code spring.datasource.username}/{@code password}.
 *
 * It is deliberately a fallback: manual configuration always wins. It does
 * nothing when {@code DB_URL} or {@code DB_HOST} is set, so an operator who has
 * already pointed the app at a database keeps control.
 */
public class DatabaseUrlEnvironmentPostProcessor
        implements EnvironmentPostProcessor, Ordered {

    static final String PROPERTY_SOURCE_NAME = "logicraftDatabaseUrl";
    private static final String JDBC_PREFIX = "jdbc:postgresql://";

    @Override
    public void postProcessEnvironment(
            ConfigurableEnvironment environment, SpringApplication application) {
        if (hasText(environment.getProperty("DB_URL"))
                || hasText(environment.getProperty("DB_HOST"))) {
            return;
        }

        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (!hasText(databaseUrl)) {
            return;
        }

        Map<String, Object> resolved = toDataSourceProperties(
                databaseUrl,
                environment.getProperty("DB_USER"),
                environment.getProperty("DB_PASSWORD"));
        if (resolved.isEmpty()) {
            return;
        }

        MutablePropertySources sources = environment.getPropertySources();
        // addFirst, not addLast: application.yml already defines
        // spring.datasource.url with a localhost default, and this has to win
        // over it without editing every property individually.
        sources.addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, resolved));
    }

    /**
     * Converts a platform database URL into Spring datasource properties.
     * Returns an empty map when the value cannot be understood, so the caller
     * leaves the environment untouched rather than pointing it at garbage.
     */
    static Map<String, Object> toDataSourceProperties(
            String databaseUrl, String configuredUser, String configuredPassword) {
        Map<String, Object> properties = new LinkedHashMap<>();

        String url = databaseUrl.trim();
        String jdbcUrl;
        String user = null;
        String password = null;

        if (url.startsWith(JDBC_PREFIX)) {
            jdbcUrl = url;
        } else {
            URI uri;
            try {
                uri = new URI(url);
            } catch (Exception e) {
                return properties;
            }

            String scheme = uri.getScheme();
            if (!"postgres".equalsIgnoreCase(scheme) && !"postgresql".equalsIgnoreCase(scheme)) {
                return properties;
            }
            if (!hasText(uri.getHost())) {
                return properties;
            }

            StringBuilder builder = new StringBuilder(JDBC_PREFIX).append(uri.getHost());
            if (uri.getPort() > 0) {
                builder.append(':').append(uri.getPort());
            }
            builder.append(hasText(uri.getPath()) ? uri.getPath() : "/");
            if (hasText(uri.getQuery())) {
                builder.append('?').append(uri.getQuery());
            }
            jdbcUrl = builder.toString();

            if (hasText(uri.getUserInfo())) {
                int separator = uri.getUserInfo().indexOf(':');
                if (separator >= 0) {
                    user = decode(uri.getUserInfo().substring(0, separator));
                    password = decode(uri.getUserInfo().substring(separator + 1));
                } else {
                    user = decode(uri.getUserInfo());
                }
            }
        }

        properties.put("spring.datasource.url", jdbcUrl);
        if (!hasText(configuredUser) && user != null) {
            properties.put("spring.datasource.username", user);
        }
        if (!hasText(configuredPassword) && password != null) {
            properties.put("spring.datasource.password", password);
        }
        return properties;
    }

    private static String decode(String value) {
        // Percent-encoded credentials are legal in a URL; Render does not emit
        // them, but a password with a reserved character would.
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    @Override
    public int getOrder() {
        // Late: any user-supplied property source should already be in place so
        // the DB_URL/DB_HOST guard above sees it.
        return Ordered.LOWEST_PRECEDENCE;
    }
}
