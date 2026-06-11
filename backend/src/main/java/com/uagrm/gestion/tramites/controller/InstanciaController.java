package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.Departamento;
import com.uagrm.gestion.tramites.model.InstanciaProceso;
import com.uagrm.gestion.tramites.model.TareaInstancia;
import com.uagrm.gestion.tramites.model.Usuario;
import com.uagrm.gestion.tramites.repository.DepartamentoRepository;
import com.uagrm.gestion.tramites.repository.InstanciaProcesoRepository;
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
@RequestMapping("/api/instancias")
@RequiredArgsConstructor
public class InstanciaController {

    private final ProcesoMotorService motorService;
    private final TareaInstanciaRepository tareaRepository;
    private final UsuarioRepository usuarioRepository;
    private final DepartamentoRepository departamentoRepository;
    private final InstanciaProcesoRepository instanciaRepository;

    @PostMapping("/iniciar")
    public ResponseEntity<InstanciaProceso> iniciar(@RequestBody Map<String, String> payload) {
        String politicaId = payload.get("politicaId");
        String xmlBpmn = payload.get("xmlBpmn");
        String solicitante = payload.get("solicitante");
        String clienteCi = payload.get("clienteCi");
        
        return ResponseEntity.ok(motorService.iniciarInstancia(politicaId, xmlBpmn, solicitante, clienteCi));
    }

    @PostMapping("/iniciar-externo")
    public ResponseEntity<Map<String, String>> iniciarExterno(@RequestBody Map<String, String> payload) {
        String politicaId = payload.get("politicaId");
        String respuestas = payload.get("respuestas");
        String clienteCi = payload.get("clienteCi");
        
        com.uagrm.gestion.tramites.model.PoliticaNegocio politica = motorService.obtenerPolitica(politicaId);
        
        InstanciaProceso instancia = motorService.iniciarInstancia(
            politicaId, 
            politica.getXmlBpmn(), 
            "Trámite Externo (Portal)",
            clienteCi
        );
        
        List<TareaInstancia> tareas = tareaRepository.findByInstanciaProcesoIdAndEstado(instancia.getId(), "PENDIENTE");
        TareaInstancia primeraTarea = tareas.isEmpty() ? null : tareas.get(0);
            
        if (primeraTarea != null) {
            motorService.completarTarea(primeraTarea.getId(), respuestas);
        }
        
        return ResponseEntity.ok(Map.of("token", instancia.getCodigoSeguimiento()));
    }

    @PostMapping("/iniciar-presencial")
    public ResponseEntity<Map<String, String>> iniciarPresencial(@RequestBody Map<String, String> payload) {
        String politicaId = payload.get("politicaId");
        String respuestas = payload.get("respuestas");
        String userEmail = payload.get("userEmail");
        String clienteCi = payload.get("clienteCi");
        
        com.uagrm.gestion.tramites.model.PoliticaNegocio politica = motorService.obtenerPolitica(politicaId);
        
        InstanciaProceso instancia = motorService.iniciarInstancia(
            politicaId, 
            politica.getXmlBpmn(), 
            "Trámite Presencial (Ventanilla)",
            clienteCi != null ? clienteCi : "ANONIMO"
        );
        
        List<TareaInstancia> tareas = tareaRepository.findByInstanciaProcesoIdAndEstado(instancia.getId(), "PENDIENTE");
        TareaInstancia primeraTarea = tareas.isEmpty() ? null : tareas.get(0);
            
        if (primeraTarea != null) {
            if (userEmail != null) {
                motorService.atenderTarea(primeraTarea.getId(), userEmail);
            }
            motorService.completarTarea(primeraTarea.getId(), respuestas);
        }
        
        return ResponseEntity.ok(Map.of("token", instancia.getCodigoSeguimiento()));
    }

    @PostMapping("/tareas/{tareaId}/completar")
    public ResponseEntity<TareaInstancia> completar(@PathVariable String tareaId, @RequestBody String respuestasJson) {
        return ResponseEntity.ok(motorService.completarTarea(tareaId, respuestasJson));
    }

    @PostMapping("/tareas/{tareaId}/atender")
    public ResponseEntity<TareaInstancia> atender(@PathVariable String tareaId, @RequestParam String userEmail) {
        return ResponseEntity.ok(motorService.atenderTarea(tareaId, userEmail));
    }

    @PostMapping("/tareas/{tareaId}/solicitar-subsanacion")
    public ResponseEntity<?> solicitarSubsanacion(@PathVariable String tareaId, @RequestBody Map<String, String> observaciones) {
        TareaInstancia tarea = tareaRepository.findById(tareaId).orElseThrow();
        InstanciaProceso instancia = motorService.obtenerInstancia(tarea.getInstanciaProcesoId());
        
        if (observaciones != null && !observaciones.isEmpty()) {
            instancia.setObservacionesCampos(observaciones);
            
            // FASE 4.2: Sincronización Genética (Modal -> Documento)
            // Si el campo observado es un archivo, marcamos su documento como OBSERVADO
            String clienteCi = instancia.getClienteCi();
            observaciones.forEach((campoRechazado, motivo) -> {
                // Buscamos el documento actual de ese tipo para este cliente/instancia
                List<com.uagrm.gestion.tramites.model.Documento> docsAsociados = motorService.obtenerDocumentosCliente(clienteCi).stream()
                    .filter(d -> d.getEsActual() && d.getTipoDocumento().equalsIgnoreCase(campoRechazado))
                    .collect(java.util.stream.Collectors.toList());
                
                for(com.uagrm.gestion.tramites.model.Documento doc : docsAsociados) {
                    doc.setEstadoDocumento("OBSERVADO");
                    doc.setMotivoObservacion(motivo);
                    // Aquí llamamos al repositorio para guardar el cambio en el documento
                    motorService.guardarDocumentoModificado(doc);
                }
            });
        }

        // 1. Cambiar estado de la instancia para que el portal sepa que debe habilitar corrección
        instancia.setEstado("EN_SUBSANACION");
        motorService.guardarInstancia(instancia);

        // 2. Marcar la tarea como enviada a subsanaciÃ³n (para que salga del monitor)
        tarea.setEstado("EN_SUBSANACION");
        tareaRepository.save(tarea);

        // 3. Notificar al ciudadano (PUSH) - ROJO (SubsanaciÃ³n)
        motorService.notificarCliente(instancia.getId(), instancia.getClienteCi(), "Requerimiento de SubsanaciÃ³n", 
            "Su trÃ¡mite tiene observaciones. Por favor revise el portal para corregirlas.", "#DC3545");

        // 4. Registrar en auditorÃ­a
        return ResponseEntity.ok(Map.of("message", "Solicitud de subsanaciÃ³n enviada al ciudadano."));

    }

    @PostMapping("/{id}/generar-documento-final")
    public ResponseEntity<?> generarDocumentoFinal(@PathVariable String id, @RequestBody Map<String, String> payload) {
        String htmlContent = payload.get("html");
        String tareaId = payload.get("tareaId");
        String userEmail = payload.get("userEmail");

        try {
            // Simulamos generación de PDF guardando el HTML directamente en S3
            byte[] htmlBytes = htmlContent.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            java.io.InputStream is = new java.io.ByteArrayInputStream(htmlBytes);
            String urlS3 = motorService.getS3Service().subirArchivo("DocumentoFinal_" + id + ".html", is, htmlBytes.length, "text/html");

            InstanciaProceso instancia = motorService.obtenerInstancia(id);
            instancia.setResultadoFinal(urlS3); // Guardamos la URL del documento como resultado final
            instancia.setEstado("FINALIZADO");
            instancia.setFechaFin(java.time.Instant.now());
            motorService.guardarInstancia(instancia);

            // Completar la tarea final
            if (tareaId != null && !tareaId.isBlank()) {
                motorService.completarTarea(tareaId, "{\"documentoFinalGenerado\": true}");
            }

            return ResponseEntity.ok(Map.of("message", "Documento generado y trámite concluido", "url", urlS3));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Error generando el documento final"));
        }
    }

    @PostMapping("/{id}/observar-campo")
    public ResponseEntity<?> observarCampo(
            @PathVariable String id, 
            @RequestParam String fieldId, 
            @RequestParam String motivo) {
        return instanciaRepository.findById(id).map(instancia -> {
            instancia.getObservacionesCampos().put(fieldId, motivo);
            return ResponseEntity.ok(instanciaRepository.save(instancia));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/aprobar-campo")
    public ResponseEntity<?> aprobarCampo(
            @PathVariable String id, 
            @RequestParam String fieldId) {
        return instanciaRepository.findById(id).map(instancia -> {
            instancia.getObservacionesCampos().remove(fieldId);
            return ResponseEntity.ok(instanciaRepository.save(instancia));
        }).orElse(ResponseEntity.notFound().build());
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
