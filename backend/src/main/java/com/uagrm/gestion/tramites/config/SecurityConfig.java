package com.uagrm.gestion.tramites.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configure(http))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/ws-bpms/**", "/h2-console/**", "/api/public/**", "/api/mobile/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()

                // RUTAS DE OPERACIÓN (Prioridad máxima para evitar 403)
                .requestMatchers("/api/instancia/**", "/api/instancias/**").hasAnyRole("ADMINISTRADOR", "FUNCIONARIO")
                
                // Rutas de perfil y actualización
                .requestMatchers("/api/usuarios/me", "/api/usuarios/update").hasAnyRole("ADMINISTRADOR", "FUNCIONARIO")
                
                // Rutas de CONSULTA (Ambos)
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/politicas/**").hasAnyRole("ADMINISTRADOR", "FUNCIONARIO")
                .requestMatchers("/api/departamentos", "/api/departamentos/**").hasAnyRole("ADMINISTRADOR", "FUNCIONARIO")
                .requestMatchers("/api/formulario/**").hasAnyRole("ADMINISTRADOR", "FUNCIONARIO")
                
                // Rutas de CREACIÓN y GESTIÓN (Solo Admin)
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
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
