package com.logicraft.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    /**
     * The origins allowed to call this API from a browser.
     *
     * Configured through CORS_ALLOWED_ORIGINS rather than hardcoded, because a
     * hardcoded list can only ever be right for the machine it was written on.
     * The list is also the whole browser-side security boundary: credentials are
     * enabled below, so a wildcard here would let any site on the internet make
     * authenticated calls as the user.
     */
    private final List<String> allowedOrigins;

    public SecurityConfig(
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http)
        throws Exception {
        return http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authorizeHttpRequests(auth ->
                auth
                    .requestMatchers(
                        "/auth/**",
                        "/shipments/**",
                        "/trips/**",
                        "/vehicles/**",
                        "/drivers/**",
                        "/warehouses/**",
                        "/zones/**",
                        "/inventory/**",
                        "/notifications/**",
                        "/audit-logs/**",
                        "/users/**",
                        "/metrics/**",
                        "/reports/**",
                        "/public/**"
                    )
                    .permitAll()
                    .anyRequest()
                    .authenticated()
            )
            .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        if (allowedOrigins.contains("*")) {
            throw new IllegalStateException(
                    "CORS_ALLOWED_ORIGINS must not be '*': credentials are enabled, so a "
                        + "wildcard would let any site make authenticated requests as the user");
        }

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(
            List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        );
        // Headers are not the security boundary — the origin list above is — so
        // "*" here just spares the browser a preflight for an unusual header.
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        // How long a browser may cache the preflight result. A redeploy that
        // changes the allowed origin would otherwise be rejected for up to an
        // hour by the browser's own cache.
        config.setMaxAge(600L);

        UrlBasedCorsConfigurationSource source =
            new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
