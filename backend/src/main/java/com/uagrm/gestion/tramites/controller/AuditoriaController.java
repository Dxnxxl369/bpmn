package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.AuditoriaLog;
import com.uagrm.gestion.tramites.service.AuditoriaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/auditoria")
@RequiredArgsConstructor
public class AuditoriaController {

    private final AuditoriaService auditoriaService;

    @GetMapping
    public ResponseEntity<List<AuditoriaLog>> listarTodos() {
        return ResponseEntity.ok(auditoriaService.obtenerTodos());
    }

    @GetMapping("/entidad/{entidadId}")
    public ResponseEntity<List<AuditoriaLog>> listarPorEntidad(@PathVariable String entidadId) {
        return ResponseEntity.ok(auditoriaService.obtenerPorEntidad(entidadId));
    }

    @PostMapping("/registrar")
    public ResponseEntity<Void> registrar(@RequestBody java.util.Map<String, String> payload) {
        System.out.println(">> [CONTROLLER] Petición de auditoría recibida: " + payload.get("accion") + " en " + payload.get("modulo"));
        try {
            auditoriaService.registrar(
                payload.get("usuarioId"), // Opcional, el servicio autodetecta si es null
                payload.get("usuarioNombre"), // Opcional
                payload.get("accion"), 
                payload.get("modulo"), 
                payload.get("entidadId"), 
                payload.get("detalles")
            );
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            System.err.println("❌ [CONTROLLER] Error en auditoría: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
