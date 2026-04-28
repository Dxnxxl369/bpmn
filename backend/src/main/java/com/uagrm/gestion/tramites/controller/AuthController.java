package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.Usuario;
import com.uagrm.gestion.tramites.repository.UsuarioRepository;
import com.uagrm.gestion.tramites.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @PostMapping("/registro")
    public ResponseEntity<Map<String, String>> registro(@RequestBody Map<String, String> payload) {
        Usuario u = new Usuario();
        u.setNombre(payload.get("nombre"));
        u.setEmail(payload.get("email"));
        u.setPasswordHash(passwordEncoder.encode(payload.get("password")));
        u.setRol("CIUDADANO"); // Rol por defecto para la app móvil
        
        usuarioRepository.save(u);
        String token = jwtService.generarToken(u);
        return ResponseEntity.ok(Map.of(
            "token", token,
            "id", u.getId(),
            "email", u.getEmail()
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String password = payload.get("password");

        return usuarioRepository.findByEmail(email)
                .filter(u -> passwordEncoder.matches(password, u.getPasswordHash()))
                .map(u -> ResponseEntity.ok(Map.of(
                    "token", jwtService.generarToken(u),
                    "id", u.getId(),
                    "email", u.getEmail()
                )))
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
}
