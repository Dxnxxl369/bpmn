package com.uagrm.gestion.tramites.service;

import com.uagrm.gestion.tramites.model.Usuario;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Service
public class JwtService {

    private static final String SECRET_KEY = "my_super_secret_key_for_jwt_generation_must_be_long_enough";
    private static final long EXPIRATION_TIME = 86400000; // 24 horas

    private final Key key = Keys.hmacShaKeyFor(SECRET_KEY.getBytes());

    public String generarToken(Usuario usuario) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("id", usuario.getId());
        claims.put("rol", usuario.getRol());
        claims.put("departamentos", usuario.getDepartamentoIds());
        claims.put("permisos", usuario.getPermisos());
        
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(usuario.getEmail())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public String extraerEmail(String token) {
        return extraerClaim(token, Claims::getSubject);
    }

    public String extraerRol(String token) {
        return extraerAllClaims(token).get("rol", String.class);
    }

    public <T> T extraerClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extraerAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extraerAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public boolean esTokenValido(String token) {
        try {
            return !extraerAllClaims(token).getExpiration().before(new Date());
        } catch (Exception e) {
            return false;
        }
    }
}
