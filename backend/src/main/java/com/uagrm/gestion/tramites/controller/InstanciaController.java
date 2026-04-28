package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.Departamento;
import com.uagrm.gestion.tramites.model.InstanciaProceso;
import com.uagrm.gestion.tramites.model.TareaInstancia;
import com.uagrm.gestion.tramites.model.Usuario;
import com.uagrm.gestion.tramites.repository.DepartamentoRepository;
import com.uagrm.gestion.tramites.repository.TareaInstanciaRepository;
import com.uagrm.gestion.tramites.repository.UsuarioRepository;
import com.uagrm.gestion.tramites.service.ProcesoMotorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/instancia", "/api/instancias"})
@RequiredArgsConstructor
public class InstanciaController {

    private final ProcesoMotorService motorService;
    private final TareaInstanciaRepository tareaRepository;
    private final UsuarioRepository usuarioRepository;
    private final DepartamentoRepository departamentoRepository;

    @PostMapping("/iniciar")
    public ResponseEntity<InstanciaProceso> iniciar(@RequestBody Map<String, String> payload) {
        String politicaId = payload.get("politicaId");
        String xmlBpmn = payload.get("xmlBpmn");
        String solicitante = payload.get("solicitante");
        
        return ResponseEntity.ok(motorService.iniciarInstancia(politicaId, xmlBpmn, solicitante));
    }

    @PostMapping("/iniciar-presencial")
    public ResponseEntity<?> iniciarPresencial(@RequestBody Map<String, String> payload) {
        String politicaId = payload.get("politicaId");
        String respuestas = payload.get("respuestas");
        String userEmail = payload.get("userEmail");
        
        // 1. Obtener la política y su XML
        com.uagrm.gestion.tramites.model.PoliticaNegocio politica = motorService.obtenerPolitica(politicaId);
        
        // 2. VALIDACIÓN DE SEGURIDAD MULTI-DEPARTAMENTO
        String deptoInicial = motorService.obtenerDepartamentoInicial(politica.getXmlBpmn());
        if (userEmail != null && deptoInicial != null) {
            Usuario usuario = usuarioRepository.findByEmail(userEmail).orElse(null);
            if (usuario != null) {
                // Obtenemos todos los LaneIds permitidos para este usuario
                List<String> misLanesPermitidos = new ArrayList<>();
                if (usuario.getLaneId() != null) misLanesPermitidos.add(usuario.getLaneId().toLowerCase());
                
                // También buscamos los nombres de sus otros departamentos asignados
                if (usuario.getDepartamentoIds() != null && !usuario.getDepartamentoIds().isEmpty()) {
                    List<String> nombresDepto = departamentoRepository.findAllById(usuario.getDepartamentoIds())
                        .stream()
                        .map(d -> d.getNombreNormalizado().toLowerCase())
                        .collect(Collectors.toList());
                    misLanesPermitidos.addAll(nombresDepto);
                }

                // Verificamos si el departamento inicial está en su lista de permitidos
                boolean tienePermiso = misLanesPermitidos.contains(deptoInicial.toLowerCase());
                
                if (!tienePermiso) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tienes permiso para iniciar este trámite. Tu departamento actual no coincide con el inicio del flujo ('" + deptoInicial + "')."));
                }
            }
        }
        
        // 3. Iniciar la instancia
        InstanciaProceso instancia = motorService.iniciarInstancia(
            politicaId, 
            politica.getXmlBpmn(), 
            "Trámite Presencial (Ventanilla)"
        );
        
        // 4. Buscar la primera tarea creada para esta instancia
        List<TareaInstancia> tareas = tareaRepository.findByLaneIdAndEstado(instancia.getLaneId(), "PENDIENTE");
        TareaInstancia primeraTarea = tareas.stream()
            .filter(t -> t.getInstanciaProcesoId().equals(instancia.getId()))
            .findFirst()
            .orElse(null);
            
        // 5. Completar automáticamente la primera tarea con los datos de ventanilla
        if (primeraTarea != null) {
            if (userEmail != null) {
                motorService.atenderTarea(primeraTarea.getId(), userEmail);
            }
            motorService.completarTarea(primeraTarea.getId(), respuestas);
        }
        
        return ResponseEntity.ok(instancia);
    }

    @PostMapping("/tareas/{tareaId}/completar")
    public ResponseEntity<TareaInstancia> completar(@PathVariable String tareaId, @RequestBody String respuestasJson) {
        return ResponseEntity.ok(motorService.completarTarea(tareaId, respuestasJson));
    }

    @PostMapping("/tareas/{tareaId}/atender")
    public ResponseEntity<TareaInstancia> atender(@PathVariable String tareaId, @RequestParam String userEmail) {
        return ResponseEntity.ok(motorService.atenderTarea(tareaId, userEmail));
    }

    @GetMapping("/{id}")
    public ResponseEntity<InstanciaProceso> getDetalle(@PathVariable String id) {
        return ResponseEntity.ok(motorService.obtenerInstancia(id));
    }

    @GetMapping("/tareas/pendientes")
    public ResponseEntity<List<TareaInstancia>> listarPendientes(@RequestParam List<String> laneId) {
        return ResponseEntity.ok(tareaRepository.findByLaneIdInAndEstado(laneId, "PENDIENTE"));
    }

    @GetMapping("/tareas/en-proceso")
    public ResponseEntity<List<TareaInstancia>> listarEnProceso(@RequestParam List<String> laneId) {
        return ResponseEntity.ok(tareaRepository.findByLaneIdInAndEstado(laneId, "EN_PROCESO"));
    }

    @GetMapping("/tareas/completadas")
    public ResponseEntity<List<TareaInstancia>> listarCompletadas(@RequestParam List<String> laneId) {
        return ResponseEntity.ok(tareaRepository.findByLaneIdInAndEstado(laneId, "COMPLETADA"));
    }
}
