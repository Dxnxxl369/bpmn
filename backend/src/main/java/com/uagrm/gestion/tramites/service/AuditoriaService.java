package com.uagrm.gestion.tramites.service;

import com.uagrm.gestion.tramites.model.AuditoriaLog;
import com.uagrm.gestion.tramites.repository.AuditoriaLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

import com.uagrm.gestion.tramites.model.Usuario;
import com.uagrm.gestion.tramites.repository.UsuarioRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;

@Service
@RequiredArgsConstructor
public class AuditoriaService {

    private final AuditoriaLogRepository repository;
    private final UsuarioRepository usuarioRepository;

    public void registrar(String usuarioId, String usuarioNombre, String accion, String modulo, String entidadId, String detalles) {
        System.out.println(">> [AUDIT] Intentando registrar acción: " + accion + " en módulo: " + modulo);
        try {
            AuditoriaLog log = new AuditoriaLog();
            
            // AUTODETECCIÓN DE USUARIO DESDE EL CONTEXTO DE SEGURIDAD
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
                String email = auth.getName();
                log.setUsuarioId(email);
                usuarioRepository.findByEmail(email).ifPresentOrElse(u -> {
                    log.setUsuarioNombre(u.getNombre() + " " + u.getApellido());
                }, () -> {
                    log.setUsuarioNombre(email);
                });
            } else {
                log.setUsuarioId(usuarioId != null ? usuarioId : "SISTEMA");
                log.setUsuarioNombre(usuarioNombre != null ? usuarioNombre : "SISTEMA");
            }

            log.setAccion(accion);
            log.setModulo(modulo);
            log.setEntidadId(entidadId);
            log.setDetalles(detalles);
            log.setTimestamp(LocalDateTime.now());
            
            repository.save(log);
            System.out.println("✅ [AUDIT] Registro guardado con éxito en DB");
        } catch (Exception e) {
            System.err.println("❌ [AUDIT] Error crítico al guardar log: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public List<AuditoriaLog> obtenerTodos() {
        return repository.findAllByOrderByTimestampDesc();
    }
    
    public List<AuditoriaLog> obtenerPorEntidad(String entidadId) {
        return repository.findByEntidadIdOrderByTimestampDesc(entidadId);
    }
}
