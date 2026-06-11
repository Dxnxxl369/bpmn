package com.uagrm.gestion.tramites.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // PERMITIR TODO LO RELACIONADO A AUDITORIA, SOCKETS, AUTH, PUBLICO Y DOCUMENTOS (PARA INICIO)
                .requestMatchers("/api/auditoria/**", "/api/auth/**", "/ws-bpms/**", "/ws-live/**", "/h2-console/**", "/api/public/**", "/api/public/triage", "/api/public/verificar-estado", "/api/mobile/**", "/api/documentos/**", "/api/instancias/iniciar-externo", "/api/ia/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                
                .requestMatchers("/api/instancias/**").hasAnyRole("ADMINISTRADOR", "FUNCIONARIO")
                .requestMatchers("/api/usuarios/me", "/api/usuarios/update", "/api/usuarios/ejecutivos").hasAnyRole("ADMINISTRADOR", "FUNCIONARIO")
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/politicas/**").hasAnyRole("ADMINISTRADOR", "FUNCIONARIO")
                .requestMatchers("/api/departamentos", "/api/departamentos/**").hasAnyRole("ADMINISTRADOR", "FUNCIONARIO")
                .requestMatchers("/api/formulario/**").hasAnyRole("ADMINISTRADOR", "FUNCIONARIO")
                .requestMatchers("/api/reportes/**").hasRole("ADMINISTRADOR")
                .requestMatchers("/api/politicas/**").hasRole("ADMINISTRADOR")
                .requestMatchers("/api/macroprocesos/**").hasRole("ADMINISTRADOR")
                .requestMatchers("/api/usuarios/**").hasRole("ADMINISTRADOR")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .headers(headers -> headers.frameOptions(frame -> frame.disable()));

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // ACEPTAR CUALQUIER PUERTO DE LOCALHOST PARA EVITAR FORBIDDEN EN 4201, 4202, ETC.
        config.setAllowedOriginPatterns(Arrays.asList("http://localhost:*", "http://127.0.0.1:*"));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setAllowCredentials(true);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
