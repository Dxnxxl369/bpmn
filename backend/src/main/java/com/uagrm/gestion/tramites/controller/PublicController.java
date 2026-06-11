package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.EstadoPolitica;
import com.uagrm.gestion.tramites.model.InstanciaProceso;
import com.uagrm.gestion.tramites.model.PoliticaNegocio;
import com.uagrm.gestion.tramites.model.TareaInstancia;
import com.uagrm.gestion.tramites.model.TareaInfo;
import com.uagrm.gestion.tramites.repository.InstanciaProcesoRepository;
import com.uagrm.gestion.tramites.repository.TareaInstanciaRepository;
import com.uagrm.gestion.tramites.repository.DocumentoRepository;
import com.uagrm.gestion.tramites.service.FormularioService;
import com.uagrm.gestion.tramites.service.PoliticaNegocioService;
import com.uagrm.gestion.tramites.service.ProcesoMotorService;
import com.uagrm.gestion.tramites.service.PushNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
@Slf4j
public class PublicController {

    private final PoliticaNegocioService politicaService;
    private final InstanciaProcesoRepository instanciaRepository;
    private final TareaInstanciaRepository tareaRepository;
    private final ProcesoMotorService motorService;
    private final com.uagrm.gestion.tramites.repository.FormularioSchemaRepository schemaRepository;
    private final com.uagrm.gestion.tramites.service.AIOrchestratorService aiOrchestrator;
    private final FormularioService formularioService;
    private final DocumentoRepository documentoRepository;
    private final PushNotificationService pushNotificationService;

    // Listar SOLO servicios ACTIVOS para el ciudadano
    @GetMapping("/servicios")
    public ResponseEntity<List<PoliticaNegocio>> listarServicios() {
        return ResponseEntity.ok(politicaService.listarPorEstado(EstadoPolitica.ACTIVA)); 
    }

    @PostMapping("/triage")
    public ResponseEntity<Map<String, String>> triage(@RequestBody Map<String, String> payload) {
        String userMessage = payload.get("mensaje");
        List<PoliticaNegocio> activas = politicaService.listarPorEstado(EstadoPolitica.ACTIVA);
        Map<String, String> recomendacion = aiOrchestrator.triage(userMessage, activas);
        return ResponseEntity.ok(recomendacion);
    }

    @PostMapping("/test-push")
    public ResponseEntity<?> testPush(@RequestBody Map<String, String> payload) {
        String token = payload.get("token");
        String titulo = payload.get("titulo") != null ? payload.get("titulo") : "Prueba de Push";
        String mensaje = payload.get("mensaje") != null ? payload.get("mensaje") : "Hola! Esto es una prueba.";
        String color = payload.get("color") != null ? payload.get("color") : "#007BFF";

        log.info("ðŸ“£ [PILOTO-PUSH] Enviando prueba a token: {}", token);
        pushNotificationService.sendPushNotification(token, titulo, mensaje, color);
        return ResponseEntity.ok(Map.of("status", "Enviado"));
    }

    @GetMapping("/politica/{id}/tareas")
    public ResponseEntity<List<TareaInfo>> listarTareasPublico(@PathVariable String id) {
        List<TareaInfo> tareas = politicaService.extraerTareasUsuario(id);
        return ResponseEntity.ok(tareas);
    }

    @GetMapping("/formulario")
    public ResponseEntity<String> getFormularioPublico(
            @RequestParam String politicaId,
            @RequestParam String taskId,
            @RequestParam(required = false) String instanciaId) {
        
        return schemaRepository.findByPoliticaIdAndTaskDefinitionId(politicaId, taskId.toLowerCase())
                .map(s -> {
                    String json = s.getSchemaJson();
                    if (instanciaId != null) {
                        json = formularioService.anotarSchemaParaSubsanacion(json, instanciaId);
                    }
                    return ResponseEntity.ok(json);
                })
                .orElse(ResponseEntity.ok("[]"));
    }

    @GetMapping("/verificar-estado")
    public ResponseEntity<?> verificarEstado(
            @RequestParam String clienteCi,
            @RequestParam String politicaId) {
        
        return instanciaRepository.findFirstByClienteCiAndPoliticaNegocioIdAndEstadoIn(clienteCi, politicaId, java.util.Arrays.asList("EN_CURSO", "EN_SUBSANACION"))
                .map(instancia -> {
                    Map<String, String> obsMapa = instancia.getObservacionesCampos();
                    
                    // NUEVA LÓGICA INFALIBLE: Es subsanación si tiene errores en el mapa O si el estado lo exige
                    boolean tieneObservaciones = (obsMapa != null && !obsMapa.isEmpty()) || "EN_SUBSANACION".equals(instancia.getEstado());
                    
                    List<Map<String, String>> observacionesDetalle = new java.util.ArrayList<>();
                    if (obsMapa != null && !obsMapa.isEmpty()) {
                        obsMapa.forEach((k, v) -> observacionesDetalle.add(Map.of("tipo", k, "motivo", v)));
                    } else if (tieneObservaciones) {
                        // Caso especial: Está en subsanación pero no hay campos específicos marcados
                        observacionesDetalle.add(Map.of("tipo", "REVISIÓN GENERAL", "motivo", "Por favor, revise su formulario y actualice la información requerida."));
                    }
                    
                    return ResponseEntity.ok(Map.of(
                        "enCurso", true,
                        "instanciaId", instancia.getId(),
                        "codigoSeguimiento", instancia.getCodigoSeguimiento(),
                        "tieneObservaciones", tieneObservaciones,
                        "observaciones", observacionesDetalle,
                        "mensaje", "Usted ya tiene un trámite de este tipo en curso."
                    ));
                })
                .orElse(ResponseEntity.ok(Map.of("enCurso", false)));
    }

    @PostMapping("/iniciar")
    public ResponseEntity<?> iniciarTramite(@RequestBody Map<String, String> payload) {
        String politicaId = payload.get("politicaId");
        String nombre = payload.get("nombre");
        String clienteCi = payload.get("clienteCi"); // NUEVO
        
        PoliticaNegocio p = politicaService.obtenerPorId(politicaId)
                .orElseThrow(() -> new RuntimeException("Servicio no encontrado"));
        
        InstanciaProceso instancia = motorService.iniciarInstancia(politicaId, p.getXmlBpmn(), nombre, clienteCi);
        return ResponseEntity.ok(Map.of("token", instancia.getId()));
    }

    @PostMapping("/subsanar-enviar")
    public ResponseEntity<?> enviarSubsanacion(@RequestBody Map<String, Object> payload) {
        String instanciaId = (String) payload.get("instanciaId");
        String respuestas = (String) payload.get("respuestas");

        return instanciaRepository.findById(instanciaId).map(instancia -> {
            // LIMPIAR OBSERVACIONES: Usar null fuerza a Mongo a borrar el campo, un mapa vacío a veces es ignorado
            instancia.setObservacionesCampos(null);
            // DEVOLVER AL ESTADO ORIGINAL PARA QUE EL FUNCIONARIO LO REVISE
            instancia.setEstado("EN_CURSO");
            instanciaRepository.save(instancia); // GUARDAR CAMBIOS EN LA INSTANCIA
            
            motorService.actualizarVariablesInstancia(instanciaId, respuestas);
            
            // DEVOLVER LA TAREA A LA BANDEJA DEL FUNCIONARIO (BÚSQUEDA A PRUEBA DE BALAS)
            List<TareaInstancia> tareas = tareaRepository.findAll().stream()
                .filter(t -> t.getInstanciaProcesoId().equals(instanciaId))
                .collect(Collectors.toList());
                
            tareas.forEach(t -> {
                // Si la tarea no está completada, la devolvemos a la bandeja del funcionario
                if (!"COMPLETADA".equals(t.getEstado())) {
                    t.setEstado("PENDIENTE");
                    tareaRepository.save(t);
                }
            });

            return ResponseEntity.ok(Map.of("message", "Subsanación enviada con éxito"));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/seguimiento/{token}")
    public ResponseEntity<?> seguimiento(@PathVariable String token) {
        if (token == null || token.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Token no proporcionado"));
        }

        String normalizedToken = token.trim().toUpperCase();
        // Si el usuario solo puso el número (ej: 123456), le ponemos el prefijo
        if (!normalizedToken.startsWith("UAGRM-") && normalizedToken.matches("\\d+")) {
            normalizedToken = "UAGRM-" + normalizedToken;
        }

        final String finalToken = normalizedToken;
        
        // Buscamos por ID, por token normalizado o por token tal cual (pero en mayúsculas)
        InstanciaProceso instancia = instanciaRepository.findById(token)
                .or(() -> instanciaRepository.findByCodigoSeguimiento(finalToken))
                .or(() -> instanciaRepository.findByCodigoSeguimiento(token.trim().toUpperCase()))
                .orElseThrow(() -> new RuntimeException("Token o Código de seguimiento no válido: " + token));
                
        String instanciaId = instancia.getId();
        // Usamos el repositorio especializado para evitar traer todas las tareas a memoria
        List<TareaInstancia> tareas = tareaRepository.findByInstanciaProcesoId(instanciaId);
        // Ordenar por fecha de inicio para Mobile
        tareas.sort((a, b) -> (a.getFechaInicio() != null && b.getFechaInicio() != null) ? a.getFechaInicio().compareTo(b.getFechaInicio()) : 0);

        // OBTENER ESTRUCTURA DE PASOS (LANES) REALES PARA EL DIAGRAMA DINÁMICO
        List<TareaInfo> estructuraPasos = politicaService.extraerTareasUsuario(instancia.getPoliticaNegocioId());
        List<String> lanesOrdenados = estructuraPasos.stream()
                .map(TareaInfo::getLane)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        
        // Si no hay lanes definidos en el BPMN (muy raro), al menos ponemos el actual
        if (lanesOrdenados.isEmpty() && instancia.getLaneId() != null) {
            lanesOrdenados.add(instancia.getLaneId());
        }

        // NUEVA LÓGICA: Leer del mapa de observaciones de la instancia (Fase 4.1)
        Map<String, String> obsMapa = instancia.getObservacionesCampos();
        List<Map<String, Object>> docResumen = new java.util.ArrayList<>();
        if (obsMapa != null) {
            obsMapa.forEach((k, v) -> {
                Map<String, Object> doc = new java.util.HashMap<>();
                doc.put("tipo", k);
                doc.put("estado", "OBSERVADO");
                doc.put("motivo", v);
                docResumen.add(doc);
            });
        }

        // OFICIALES: Documentos generados por funcionarios (Fase Final)
        List<com.uagrm.gestion.tramites.model.Documento> oficiales;
        if ("FINALIZADO".equals(instancia.getEstado())) {
            // Si estÃ¡ finalizado, SOLO mostramos los consolidados (PDFs)
            oficiales = documentoRepository.findByInstanciaId(instanciaId).stream()
                    .filter(d -> "ENTREGABLE_FINAL".equals(d.getTipoDocumento()))
                    .collect(Collectors.toList());
        } else {
            // Si estÃ¡ en curso, mostramos los borradores actuales (Solo lectura)
            oficiales = documentoRepository.findByInstanciaIdAndEsColaborativoTrueAndEsActualTrue(instanciaId);
        }
        log.info("ðŸ”🔍 [TRACKING-DEBUG] Instancia: {} | Entregables finales: {}", instanciaId, oficiales.size());

        // Construimos la respuesta con HashMap para permitir valores nulos sin errores de Map.of
        Map<String, Object> response = new java.util.HashMap<>();
        response.put("instancia", instancia);
        response.put("tareas", tareas);
        response.put("lanes", lanesOrdenados); // LISTA DINÁMICA DE DEPARTAMENTOS
        response.put("documentos", docResumen);
        response.put("oficiales", oficiales); // NUEVA SECCIÃ“N
        response.put("nodoActual", instancia.getNodoActualId() != null ? instancia.getNodoActualId() : "Inicio");
        response.put("estado", instancia.getEstado() != null ? instancia.getEstado() : "EN_CURSO");

        return ResponseEntity.ok(response);
    }
}
