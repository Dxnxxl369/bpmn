package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.service.AiAssistantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.aggregation.*;
import org.springframework.data.domain.Sort;
import com.uagrm.gestion.tramites.model.AuditoriaLog;
import com.uagrm.gestion.tramites.model.Usuario;
import com.uagrm.gestion.tramites.model.Departamento;
import com.uagrm.gestion.tramites.model.EstadisticaTarea;
import com.uagrm.gestion.tramites.model.TareaInstancia;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/reportes")
@RequiredArgsConstructor
public class ReporteController {

    private final AiAssistantService aiService;
    private final MongoTemplate mongoTemplate;
    private final ObjectMapper objectMapper;

    @PostMapping("/ia-filtro")
    public ResponseEntity<Map<String, Object>> generarReporteIA(@RequestBody Map<String, String> request) {
        String prompt = request.get("prompt");
        LocalDateTime hoy = LocalDateTime.now();
        String fechaHoyStr = hoy.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        String diaSemanaHoy = hoy.getDayOfWeek().name();

        String systemPrompt = String.format("""
                Eres el Analista Estratégico de la Suite BPMS. Tu objetivo es generar un QUERY PLAN avanzado.
                CONTEXTO: Hoy es %s (%s).
                
                TARGETS:
                - 'ACTIVIDAD': Eventos de auditoría.
                - 'USUARIOS': Lista de personal.
                - 'RENDIMIENTO': Para rankings, "quién hizo más", "más productivo", "más tareas hechas".
                - 'CARGA': Para "más tareas pendientes", "cuellos de botella", "quién tiene más trabajo acumulado".
                
                INSTRUCCIONES:
                - Si pide rankings de productividad, usa 'RENDIMIENTO'.
                - Si pide quién tiene más trabajo pendiente, usa 'CARGA'.
                - Genera un 'resumen' profesional.
                
                SCHEMA:
                {
                  "target": "ACTIVIDAD" | "USUARIOS" | "RENDIMIENTO" | "CARGA",
                  "resumen": "string",
                  "filtros": { "departamentoNombre": null, "rol": null },
                  "visibilidad": { "usuarioNombre": true, "cantidad": true, "departamento": true, "rol": bool }
                }
                """, diaSemanaHoy, fechaHoyStr);

        String jsonResStr = aiService.consultarIA(systemPrompt, prompt);
        
        try {
            String cleanJson = "{}";
            Pattern pattern = Pattern.compile("\\{.*\\}", Pattern.DOTALL);
            Matcher matcher = pattern.matcher(jsonResStr);
            if (matcher.find()) cleanJson = matcher.group();

            Map<String, Object> queryPlan = objectMapper.readValue(cleanJson, Map.class);
            String target = (String) queryPlan.getOrDefault("target", "ACTIVIDAD");
            Map<String, Object> filtros = (Map<String, Object>) queryPlan.getOrDefault("filtros", new HashMap<>());
            
            List<Map<String, Object>> data;
            if ("RENDIMIENTO".equals(target)) {
                data = calcularRendimiento(filtros);
            } else if ("CARGA".equals(target)) {
                data = calcularCargaTrabajo(filtros);
            } else if ("USUARIOS".equals(target)) {
                data = consultarUsuarios(filtros);
            } else {
                data = ejecutarBusquedaDinamica(filtros);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("data", data);
            response.put("visibilidad", queryPlan.get("visibilidad"));
            response.put("resumen", queryPlan.get("resumen"));
            response.put("total", data.size());
            response.put("target", target);
            response.put("debug_ia", cleanJson);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    private List<Map<String, Object>> calcularRendimiento(Map<String, Object> filtros) {
        // Agregación sobre estadisticas_tarea para ver tareas completadas
        Aggregation agg = Aggregation.newAggregation(
            Aggregation.group("usuarioId", "usuarioNombre").count().as("cantidad"),
            Aggregation.sort(Sort.Direction.DESC, "cantidad"),
            Aggregation.project("cantidad").and("_id.usuarioNombre").as("usuarioNombre").andExclude("_id")
        );

        AggregationResults<Map> results = mongoTemplate.aggregate(agg, "estadisticas_tarea", Map.class);
        return results.getMappedResults().stream().map(m -> {
            Map<String, Object> res = new HashMap<>(m);
            // Inyectar departamento
            Usuario u = mongoTemplate.findOne(new Query(Criteria.where("nombre").regex(m.get("usuarioNombre").toString(), "i")), Usuario.class);
            if (u != null && !u.getDepartamentoIds().isEmpty()) {
                Departamento d = mongoTemplate.findById(u.getDepartamentoIds().get(0), Departamento.class);
                res.put("departamento", d != null ? d.getNombreOriginal() : "N/A");
                res.put("rol", u.getRol());
            }
            return res;
        }).collect(Collectors.toList());
    }

    private List<Map<String, Object>> calcularCargaTrabajo(Map<String, Object> filtros) {
        // Agregación sobre tareas_instancia para ver tareas pendientes (estado != COMPLETADO)
        Aggregation agg = Aggregation.newAggregation(
            Aggregation.match(Criteria.where("estado").ne("COMPLETADO")),
            Aggregation.group("laneId").count().as("cantidad"),
            Aggregation.sort(Sort.Direction.DESC, "cantidad"),
            Aggregation.project("cantidad").and("_id").as("departamento").andExclude("_id")
        );

        AggregationResults<Map> results = mongoTemplate.aggregate(agg, "tareas_instancia", Map.class);
        return results.getMappedResults().stream().map(m -> {
            Map<String, Object> res = new HashMap<>(m);
            res.put("usuarioNombre", "CARGA POR ÁREA");
            res.put("rol", "N/A");
            return res;
        }).collect(Collectors.toList());
    }

    private List<Map<String, Object>> consultarUsuarios(Map<String, Object> filtros) {
        Query query = new Query();
        if (filtros.get("rol") != null && !filtros.get("rol").toString().equals("null")) {
            query.addCriteria(Criteria.where("rol").is(filtros.get("rol").toString()));
        }
        if (filtros.get("departamentoNombre") != null && !filtros.get("departamentoNombre").toString().equals("null")) {
            Departamento depto = mongoTemplate.findOne(new Query(Criteria.where("nombreOriginal").regex(filtros.get("departamentoNombre").toString(), "i")), Departamento.class);
            if (depto != null) query.addCriteria(Criteria.where("departamentoIds").in(depto.getId()));
        }

        return mongoTemplate.find(query, Usuario.class).stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("usuarioNombre", u.getNombre() + " " + (u.getApellido() != null ? u.getApellido() : ""));
            map.put("rol", u.getRol());
            map.put("email", u.getEmail());
            if (!u.getDepartamentoIds().isEmpty()) {
                Departamento d = mongoTemplate.findById(u.getDepartamentoIds().get(0), Departamento.class);
                map.put("departamento", d != null ? d.getNombreOriginal() : "N/A");
            }
            return map;
        }).collect(Collectors.toList());
    }

    private List<Map<String, Object>> ejecutarBusquedaDinamica(Map<String, Object> filtros) {
        Query query = new Query();
        List<Criteria> criterias = new ArrayList<>();
        Set<String> emailsFiltrados = null;

        if (filtros.get("rol") != null && !filtros.get("rol").toString().equals("null") && !filtros.get("rol").toString().isEmpty()) {
            List<Usuario> usuarios = mongoTemplate.find(new Query(Criteria.where("rol").is(filtros.get("rol").toString())), Usuario.class);
            Set<String> emails = usuarios.stream().map(Usuario::getEmail).collect(Collectors.toSet());
            if (emailsFiltrados == null) emailsFiltrados = emails;
            else emailsFiltrados.retainAll(emails);
        }

        if (filtros.get("departamentoNombre") != null && !filtros.get("departamentoNombre").toString().equals("null") && !filtros.get("departamentoNombre").toString().isEmpty()) {
            Departamento depto = mongoTemplate.findOne(new Query(Criteria.where("nombreOriginal").regex(filtros.get("departamentoNombre").toString(), "i")), Departamento.class);
            if (depto != null) {
                List<Usuario> usuarios = mongoTemplate.find(new Query(Criteria.where("departamentoIds").in(depto.getId())), Usuario.class);
                Set<String> emails = usuarios.stream().map(Usuario::getEmail).collect(Collectors.toSet());
                if (emailsFiltrados == null) emailsFiltrados = emails;
                else emailsFiltrados.retainAll(emails);
            } else emailsFiltrados = new HashSet<>();
        }

        if (emailsFiltrados != null) criterias.add(Criteria.where("usuarioId").in(emailsFiltrados));

        try {
            if (filtros.get("fechaInicio") != null && !filtros.get("fechaInicio").toString().equals("null") && !filtros.get("fechaInicio").toString().isEmpty()) {
                criterias.add(Criteria.where("timestamp").gte(LocalDateTime.parse(filtros.get("fechaInicio").toString())));
            }
            if (filtros.get("fechaFin") != null && !filtros.get("fechaFin").toString().equals("null") && !filtros.get("fechaFin").toString().isEmpty()) {
                criterias.add(Criteria.where("timestamp").lte(LocalDateTime.parse(filtros.get("fechaFin").toString())));
            }
        } catch (Exception e) {}

        if (!criterias.isEmpty()) query.addCriteria(new Criteria().andOperator(criterias.toArray(new Criteria[0])));
        
        return mongoTemplate.find(query.limit(1000), AuditoriaLog.class).stream().map(log -> {
            Map<String, Object> map = new HashMap<>();
            map.put("usuarioNombre", log.getUsuarioNombre());
            map.put("timestamp", log.getTimestamp());
            Usuario u = mongoTemplate.findOne(new Query(Criteria.where("email").is(log.getUsuarioId())), Usuario.class);
            if (u != null) {
                map.put("rol", u.getRol());
                if (!u.getDepartamentoIds().isEmpty()) {
                    Departamento d = mongoTemplate.findById(u.getDepartamentoIds().get(0), Departamento.class);
                    map.put("departamento", d != null ? d.getNombreOriginal() : "N/A");
                }
            }
            return map;
        }).collect(Collectors.toList());
    }

    @PostMapping("/manual")
    public ResponseEntity<Map<String, Object>> generarReporteManual(@RequestBody Map<String, Object> filtros) {
        Map<String, Object> res = new HashMap<>();
        res.put("data", ejecutarBusquedaDinamica(filtros));
        return ResponseEntity.ok(res);
    }
}
