package com.uagrm.gestion.tramites.config;

import com.uagrm.gestion.tramites.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        if (jwtService.esTokenValido(token)) {
            String email = jwtService.extraerEmail(token);
            String rol = jwtService.extraerRol(token);
            if (rol != null) rol = rol.toUpperCase(); // Normalización total
            
            System.out.println("SECURITY DEBUG: Usuario " + email + " autenticado con rol: " + rol);
            
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    email, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + rol))
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }
}
