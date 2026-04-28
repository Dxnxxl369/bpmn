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

    @GetMapping("/ejecutivos")
    public ResponseEntity<List<Usuario>> listarEjecutivos() {
        return ResponseEntity.ok(usuarioRepository.findAll().stream()
                .filter(u -> "FUNCIONARIO".equals(u.getRol()))
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
    public ResponseEntity<Usuario> updatePerfil(@RequestBody Usuario updatedUser) {
        Usuario usuario = usuarioRepository.findByEmail(updatedUser.getEmail()).orElseThrow();
        usuario.setNombre(updatedUser.getNombre());
        usuario.setApellido(updatedUser.getApellido());
        usuario.setUsername(updatedUser.getUsername());
        usuario.setAvatar(updatedUser.getAvatar());
        return ResponseEntity.ok(usuarioRepository.save(usuario));
    }

    @PutMapping("/{id}/departamentos")
    public ResponseEntity<Usuario> asignarDepartamentos(@PathVariable String id, @RequestBody List<String> departamentoIds) {
        Usuario usuario = usuarioRepository.findById(id).orElseThrow();
        usuario.setDepartamentoIds(departamentoIds);
        
        if (!departamentoIds.isEmpty()) {
            departamentoRepository.findById(departamentoIds.get(0)).ifPresent(d -> {
                usuario.setLaneId(d.getNombreNormalizado());
            });
        } else {
            usuario.setLaneId(null);
        }
        
        return ResponseEntity.ok(usuarioRepository.save(usuario));
    }
}
