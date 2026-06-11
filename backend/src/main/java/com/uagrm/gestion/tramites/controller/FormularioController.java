package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.FormularioSchema;
import com.uagrm.gestion.tramites.model.TareaInfo;
import com.uagrm.gestion.tramites.repository.FormularioSchemaRepository;
import com.uagrm.gestion.tramites.service.FormularioService;
import com.uagrm.gestion.tramites.service.PoliticaNegocioService;
import com.uagrm.gestion.tramites.service.DepartamentoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/formulario")
@RequiredArgsConstructor
public class FormularioController {

    private final FormularioService formularioService;
    private final FormularioSchemaRepository schemaRepository;
    private final PoliticaNegocioService politicaService;
    private final DepartamentoService departamentoService;

    @GetMapping("/politica/{id}/tareas")
    public ResponseEntity<List<TareaInfo>> listarTareas(@PathVariable String id) {
        List<TareaInfo> tareas = politicaService.extraerTareasUsuario(id);
        List<FormularioSchema> schemas = schemaRepository.findByPoliticaId(id);

        for (TareaInfo t : tareas) {
            Optional<FormularioSchema> s = schemas.stream()
                .filter(sch -> sch.getTaskDefinitionId().equalsIgnoreCase(t.getId()))
                .findFirst();
            
            t.setTieneFormulario(s.isPresent());
            t.setEstadoFormulario(s.map(FormularioSchema::getEstado).orElse("VACIO"));
        }
        return ResponseEntity.ok(tareas);
    }

    @PostMapping("/politica/{politicaId}/tarea/{taskId}/generar")
    public ResponseEntity<FormularioSchema> generarIndividual(
            @PathVariable String politicaId, 
            @PathVariable String taskId,
            @RequestParam String taskName) {
        
        // Obtener ramas de decisión para el prompt de la IA
        List<TareaInfo> tareas = politicaService.extraerTareasUsuario(politicaId);
        TareaInfo estaTarea = tareas.stream()
                .filter(t -> t.getId().equalsIgnoreCase(taskId))
                .findFirst().orElse(null);

        List<String> opciones = (estaTarea != null) ? estaTarea.getRamas().stream()
                .map(TareaInfo.DecisionBranch::getCondicion)
                .collect(java.util.stream.Collectors.toList()) : List.of();

        String schemaJson = formularioService.generateFormFields(taskName, "Tarea del proceso", "BPMS", opciones);
        
        // FUSIÓN ESTRUCTURAL: Asegurar que el enrutador esté presente y sea correcto
        schemaJson = fuseDecisionLogic(schemaJson, estaTarea);

        Optional<FormularioSchema> exist = schemaRepository.findByPoliticaIdAndTaskDefinitionId(politicaId, taskId.toLowerCase());
        FormularioSchema schema = exist.orElse(new FormularioSchema());
        
        schema.setPoliticaId(politicaId);
        schema.setTaskDefinitionId(taskId.toLowerCase());
        schema.setNombreTarea(taskName);
        schema.setSchemaJson(schemaJson);
        schema.setEstado("BORRADOR"); 

        // Resolver Departamento (Lane) real
        String rawLane = politicaService.obtenerLaneDeTarea(politicaId, taskId);
        schema.setLaneId(departamentoService.resolverDepartamentoReal(rawLane));
        
        return ResponseEntity.ok(schemaRepository.save(schema));
    }

    @PostMapping("/politica/{politicaId}/tarea/{taskId}/guardar")
    public ResponseEntity<FormularioSchema> guardarManual(
            @PathVariable String politicaId, 
            @PathVariable String taskId,
            @RequestParam String estado,
            @RequestParam(required = false) String taskName,
            @RequestBody String schemaJson) {

        // FUSIÓN ESTRUCTURAL: Protegemos el enrutador también en el guardado manual
        List<TareaInfo> tareas = politicaService.extraerTareasUsuario(politicaId);
        TareaInfo estaTarea = tareas.stream()
                .filter(t -> t.getId().equalsIgnoreCase(taskId))
                .findFirst().orElse(null);
        
        schemaJson = fuseDecisionLogic(schemaJson, estaTarea);

        Optional<FormularioSchema> exist = schemaRepository.findByPoliticaIdAndTaskDefinitionId(politicaId, taskId.toLowerCase());
        FormularioSchema schema = exist.orElse(new FormularioSchema());

        schema.setPoliticaId(politicaId);
        schema.setTaskDefinitionId(taskId.toLowerCase());
        schema.setSchemaJson(schemaJson);
        schema.setEstado(estado);

        if (taskName != null) {
            schema.setNombreTarea(taskName);
        }

        // Resolver Departamento (Lane) real
        String rawLane = politicaService.obtenerLaneDeTarea(politicaId, taskId);
        schema.setLaneId(departamentoService.resolverDepartamentoReal(rawLane));

        return ResponseEntity.ok(schemaRepository.save(schema));
    }

    private String fuseDecisionLogic(String json, TareaInfo info) {
        if (json == null || json.isBlank()) json = "[]";
        
        // Limpieza profunda de caracteres invisibles y BOM
        String cleanJson = json.replace("\uFEFF", "").trim();

        if (info == null || !info.isEsPuntoDecision() || info.getRamas() == null || info.getRamas().isEmpty()) {
            return cleanJson;
        }

        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            List<Map<String, Object>> fields;
            
            try {
                // Si ya es un array, lo parseamos
                if (cleanJson.startsWith("[")) {
                    fields = mapper.readValue(cleanJson, new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                } else if (cleanJson.startsWith("{")) {
                    // Si es un objeto único o lista sin [], lo envolvemos
                    String wrapped = "[" + cleanJson + "]";
                    fields = mapper.readValue(wrapped, new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                } else {
                    return cleanJson;
                }
            } catch (Exception e) {
                // Caso especial: El JSON viene como un String de JSON (con comillas extras)
                if (cleanJson.startsWith("\"") && cleanJson.endsWith("\"")) {
                    String unquoted = mapper.readValue(cleanJson, String.class);
                    fields = mapper.readValue(unquoted, new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                } else {
                    return cleanJson;
                }
            }
            
            Map<String, Object> decisionField = fields.stream()
                    .filter(f -> "decision_motor".equals(f.get("id")))
                    .findFirst().orElse(null);

            List<String> opcionesBpm = info.getRamas().stream()
                    .map(TareaInfo.DecisionBranch::getCondicion)
                    .collect(java.util.stream.Collectors.toList());

            if (decisionField == null) {
                decisionField = new java.util.HashMap<>();
                decisionField.put("id", "decision_motor");
                decisionField.put("label", "¿Hacia dónde continúa el trámite?");
                decisionField.put("type", "select");
                decisionField.put("required", true);
                decisionField.put("options", opcionesBpm);
                fields.add(decisionField);
            } else {
                decisionField.put("type", "select");
                decisionField.put("required", true);
                decisionField.put("options", opcionesBpm);
            }

            return mapper.writeValueAsString(fields).trim();
        } catch (Exception e) {
            return cleanJson;
        }
    }


    @GetMapping("/politica/{id}/status")
    public ResponseEntity<Map<String, Object>> checkStatus(@PathVariable String id) {
        List<TareaInfo> tareas = politicaService.extraerTareasUsuario(id);
        List<FormularioSchema> schemas = schemaRepository.findByPoliticaId(id);
        
        boolean todosListos = !tareas.isEmpty() && tareas.stream().allMatch(t -> 
            schemas.stream().anyMatch(s -> s.getTaskDefinitionId().equalsIgnoreCase(t.getId()) && "LISTO".equals(s.getEstado()))
        );

        return ResponseEntity.ok(Map.of(
            "total", tareas.size(),
            "configuradas", (int) schemas.stream().filter(s -> "LISTO".equals(s.getEstado())).count(),
            "listoParaPublicar", todosListos
        ));
    }

    @GetMapping("/generar")
    public ResponseEntity<String> getRuntimeForm(
            @RequestParam String politicaId,
            @RequestParam String taskId) {
        
        Optional<FormularioSchema> schemaOpt = schemaRepository.findByPoliticaIdAndTaskDefinitionId(politicaId, taskId.toLowerCase());
        
        if (schemaOpt.isPresent()) {
            FormularioSchema schema = schemaOpt.get();
            String schemaJson = schema.getSchemaJson();
            if (schemaJson == null || schemaJson.isBlank()) schemaJson = "[]";
            
            List<TareaInfo> tareas = politicaService.extraerTareasUsuario(politicaId);
            TareaInfo estaTarea = tareas.stream()
                    .filter(t -> t.getId().equalsIgnoreCase(taskId))
                    .findFirst().orElse(null);
            
            schemaJson = fuseDecisionLogic(schemaJson, estaTarea);
            return ResponseEntity.ok(schemaJson.trim());
        }
        
        return ResponseEntity.ok("[]");
    }
}
