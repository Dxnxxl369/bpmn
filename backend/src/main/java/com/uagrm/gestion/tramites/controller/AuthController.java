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
    public ResponseEntity<?> registro(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String ci = payload.get("ci");

        if (usuarioRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "El correo ya estÃ¡ registrado"));
        }
        if (usuarioRepository.findByCi(ci).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "El CI ya estÃ¡ registrado"));
        }

        Usuario u = new Usuario();
        u.setNombre(payload.get("nombre"));
        u.setApellido(payload.get("apellido"));
        u.setEmail(email);
        u.setCi(ci);
        u.setCelular(payload.get("celular"));
        u.setPasswordHash(passwordEncoder.encode(payload.get("password")));
        u.setRol("CIUDADANO");

        usuarioRepository.save(u);
        String token = jwtService.generarToken(u);
        return ResponseEntity.ok(Map.of(
            "token", token,
            "id", u.getId(),
            "email", u.getEmail(),
            "ci", u.getCi() != null ? u.getCi() : "",
            "nombre", u.getNombre() != null ? u.getNombre() : "",
            "apellido", u.getApellido() != null ? u.getApellido() : "",
            "celular", u.getCelular() != null ? u.getCelular() : ""
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
                    "email", u.getEmail(),
                    "ci", u.getCi() != null ? u.getCi() : "",
                    "nombre", u.getNombre() != null ? u.getNombre() : "",
                    "apellido", u.getApellido() != null ? u.getApellido() : "",
                    "celular", u.getCelular() != null ? u.getCelular() : ""
                )))
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
}
