package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.Usuario;
import com.uagrm.gestion.tramites.repository.UsuarioRepository;
import com.uagrm.gestion.tramites.repository.DepartamentoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioRepository usuarioRepository;
    private final DepartamentoRepository departamentoRepository;
    private final com.uagrm.gestion.tramites.service.AuditoriaService auditoriaService;

    @GetMapping("/ejecutivos")
    public ResponseEntity<List<Usuario>> listarEjecutivos() {
        return ResponseEntity.ok(usuarioRepository.findAll().stream()
                .filter(u -> !"CIUDADANO".equals(u.getRol()))
                .collect(Collectors.toList()));
    }

    @GetMapping("/me")
    public ResponseEntity<Usuario> getMiPerfil(@RequestParam String email) {
        Usuario usuario = usuarioRepository.findByEmail(email).orElseThrow();
        // Sincronizar laneId si es necesario
        if ((usuario.getLaneId() == null || usuario.getLaneId().isEmpty()) && !usuario.getDepartamentoIds().isEmpty()) {
            com.uagrm.gestion.tramites.model.Departamento d = departamentoRepository.findById(usuario.getDepartamentoIds().get(0)).orElse(null);
            if (d != null) {
                usuario.setLaneId(d.getNombreNormalizado());
                usuario = usuarioRepository.save(usuario);
            }
        }
        return ResponseEntity.ok(usuario);
    }

    @PutMapping("/update")
    public ResponseEntity<?> updatePerfil(@RequestBody Usuario updatedUser) {
        try {
            System.out.println(">> [PERFIL] Intentando actualizar usuario: " + updatedUser.getEmail());
            Usuario usuario = usuarioRepository.findByEmail(updatedUser.getEmail())
                    .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + updatedUser.getEmail()));
            
            usuario.setNombre(updatedUser.getNombre());
            usuario.setApellido(updatedUser.getApellido());
            usuario.setUsername(updatedUser.getUsername());
            
            if (updatedUser.getAvatar() != null && !updatedUser.getAvatar().isEmpty()) {
                System.out.println(">> [PERFIL] Actualizando avatar (Tamaño: " + updatedUser.getAvatar().length() + " chars)");
                usuario.setAvatar(updatedUser.getAvatar());
            }
            
            Usuario saved = usuarioRepository.save(usuario);
            System.out.println("✅ [PERFIL] Usuario actualizado con éxito");
            auditoriaService.registrar(null, null, "ACTUALIZAR_PERFIL", "USUARIOS", saved.getId(), "Perfil actualizado: " + saved.getEmail());
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            System.err.println("❌ [PERFIL] Error al actualizar: " + e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/departamentos")
    public ResponseEntity<Usuario> asignarDepartamentos(@PathVariable String id, @RequestBody List<String> departamentoIds) {
        Usuario usuario = usuarioRepository.findById(id).orElseThrow();
        usuario.setDepartamentoIds(departamentoIds);
        
        if (!departamentoIds.isEmpty()) {
            departamentoRepository.findById(departamentoIds.get(0)).ifPresent(d -> {
                usuario.setLaneId(d.getNombreNormalizado());
                auditoriaService.registrar(null, null, "ASIGNAR_DEPARTAMENTO", "USUARIOS", id, "Empleado: " + usuario.getEmail() + " -> " + d.getNombreOriginal());
            });
        } else {
            usuario.setLaneId(null);
            auditoriaService.registrar(null, null, "QUITAR_DEPARTAMENTO", "USUARIOS", id, "Empleado desvinculado: " + usuario.getEmail());
        }
        
        return ResponseEntity.ok(usuarioRepository.save(usuario));
    }
}
