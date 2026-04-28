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
        List<String> opciones = tareas.stream()
                .filter(t -> t.getId().equalsIgnoreCase(taskId))
                .flatMap(t -> t.getRamas().stream())
                .map(TareaInfo.DecisionBranch::getCondicion)
                .collect(java.util.stream.Collectors.toList());

        String schemaJson = formularioService.generateFormFields(taskName, "Tarea del proceso", "BPMS", opciones);
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
        
        return schemaRepository.findByPoliticaIdAndTaskDefinitionId(politicaId, taskId.toLowerCase())
                .map(s -> ResponseEntity.ok(s.getSchemaJson()))
                .orElse(ResponseEntity.notFound().build());
    }
}
