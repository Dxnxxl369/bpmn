package com.uagrm.gestion.tramites.service;

import com.uagrm.gestion.tramites.model.TareaInstancia;
import com.uagrm.gestion.tramites.model.InstanciaProceso;
import com.uagrm.gestion.tramites.model.Usuario;
import com.uagrm.gestion.tramites.model.Departamento;
import com.uagrm.gestion.tramites.repository.TareaInstanciaRepository;
import com.uagrm.gestion.tramites.repository.InstanciaProcesoRepository;
import com.uagrm.gestion.tramites.repository.UsuarioRepository;
import com.uagrm.gestion.tramites.repository.DepartamentoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnaliticasService {

    private final TareaInstanciaRepository tareaRepository;
    private final InstanciaProcesoRepository instanciaRepository;
    private final UsuarioRepository usuarioRepository;
    private final DepartamentoRepository departamentoRepository;
    private final MongoTemplate mongoTemplate;
    private final AIOrchestratorService aiOrchestratorService;

    public Map<String, Object> getMetricasGlobales() {
        List<InstanciaProceso> todasLasInstancias = instanciaRepository.findAll();
        List<TareaInstancia> todasLasTareas = tareaRepository.findAll();
        
        List<TareaInstancia> completadas = todasLasTareas.stream()
                .filter(t -> t.getEstado() != null && t.getEstado().startsWith("COMPLETA") 
                        && t.getFechaInicio() != null && t.getFechaCompletado() != null)
                .collect(Collectors.toList());

        Map<String, Object> global = new HashMap<>();

        // 1. KPIs BÁSICOS
        double esperaTotal = completadas.stream()
                .mapToLong(t -> t.getFechaAtencion() != null ? Duration.between(t.getFechaInicio(), t.getFechaAtencion()).getSeconds() : 0)
                .average().orElse(0);
        
        double trabajoTotal = completadas.stream()
                .mapToLong(t -> t.getFechaAtencion() != null ? Duration.between(t.getFechaAtencion(), t.getFechaCompletado()).getSeconds() : Duration.between(t.getFechaInicio(), t.getFechaCompletado()).getSeconds())
                .average().orElse(0);

        global.put("totalTareas", (long) todasLasInstancias.size());
        global.put("esperaPromedioGlobal", esperaTotal);
        global.put("ejecucionPromedioGlobal", trabajoTotal);

        // 2. CUELLO DE BOTELLA
        String deptoLento = completadas.stream()
                .collect(Collectors.groupingBy(t -> t.getLaneId() != null ? t.getLaneId().toUpperCase() : "GENERAL",
                        Collectors.averagingDouble(t -> t.getFechaAtencion() != null ? Duration.between(t.getFechaInicio(), t.getFechaAtencion()).getSeconds() : 0)))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("Ventanilla");
        global.put("cuelloCritico", deptoLento);

        // 3. RANKING DE FUNCIONARIOS (CON DATOS DE REACCIÓN Y TENDENCIA)
        List<Map<String, Object>> rankingGlobal = new ArrayList<>();
        usuarioRepository.findAll().stream()
                .filter(u -> "FUNCIONARIO".equals(u.getRol()) || "ADMINISTRADOR".equals(u.getRol()))
                .forEach(u -> {
                    List<TareaInstancia> susTareas = completadas.stream()
                            .filter(t -> u.getId().equals(t.getUsuarioId()))
                            .collect(Collectors.toList());
                    
                    Map<String, Object> entry = new HashMap<>();
                    entry.put("nombre", u.getNombre() + " " + u.getApellido());
                    entry.put("avatar", u.getAvatar());
                    
                    // Tiempo de Atención Promedio (Desde que abre hasta que termina)
                    double tma = susTareas.stream()
                        .mapToLong(t -> Duration.between(t.getFechaAtencion() != null ? t.getFechaAtencion() : t.getFechaInicio(), t.getFechaCompletado()).getSeconds())
                        .average().orElse(0);
                    
                    // Tiempo de Reacción (Desde que se crea la tarea hasta que la atiende)
                    double reaccion = susTareas.stream()
                        .filter(t -> t.getFechaAtencion() != null)
                        .mapToLong(t -> Duration.between(t.getFechaInicio(), t.getFechaAtencion()).getSeconds())
                        .average().orElse(0);
                    
                    entry.put("tma", tma);
                    entry.put("reaccion", reaccion);
                    entry.put("promedioGlobal", tma);
                    entry.put("tareasRealizadas", (long) susTareas.size());
                    entry.put("tendencia", calcularTendencia(susTareas));
                    
                    rankingGlobal.add(entry);
                });
        
        rankingGlobal.sort((a, b) -> {
            long tA = (long) a.get("tareasRealizadas");
            long tB = (long) b.get("tareasRealizadas");
            if (tA == 0 && tB == 0) return 0;
            if (tA == 0) return 1; if (tB == 0) return -1;
            return Double.compare((Double) a.get("promedioGlobal"), (Double) b.get("promedioGlobal"));
        });
        global.put("rankingGlobal", rankingGlobal);

        // 4. RENDIMIENTO DEPTOS
        Map<String, Map<String, Object>> rendimientoDeptos = new HashMap<>();
        completadas.stream().collect(Collectors.groupingBy(t -> t.getLaneId() != null ? t.getLaneId().toUpperCase() : "GENERAL"))
                .forEach((depto, list) -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("espera", list.stream().mapToLong(t -> t.getFechaAtencion() != null ? Duration.between(t.getFechaInicio(), t.getFechaAtencion()).getSeconds() : 0).average().orElse(0));
                    m.put("trabajo", list.stream().mapToLong(t -> Duration.between(t.getFechaAtencion() != null ? t.getFechaAtencion() : t.getFechaInicio(), t.getFechaCompletado()).getSeconds()).average().orElse(0));
                    rendimientoDeptos.put(depto, m);
                });
        global.put("rendimientoDeptos", rendimientoDeptos);

        // 5. TRAFICO 24H
        List<Long> serieTrafico = new ArrayList<>(Collections.nCopies(24, 0L));
        todasLasInstancias.forEach(inst -> {
            if (inst.getFechaInicio() != null) {
                int hora = LocalDateTime.ofInstant(inst.getFechaInicio(), ZoneId.systemDefault()).getHour();
                serieTrafico.set(hora, serieTrafico.get(hora) + 1);
            }
        });
        global.put("serieTrafico", serieTrafico);

        // 6. SATURACIÓN ACTUAL (BACKLOG)
        List<TareaInstancia> pendientes = todasLasTareas.stream()
                .filter(t -> t.getEstado() == null || !t.getEstado().startsWith("COMPLETA"))
                .collect(Collectors.toList());
        
        Map<String, Map<String, Object>> saturationMap = new HashMap<>();
        pendientes.stream().collect(Collectors.groupingBy(t -> t.getLaneId() != null ? t.getLaneId().toUpperCase() : "GENERAL"))
                .forEach((depto, list) -> {
                    Map<String, Object> s = new HashMap<>();
                    long backlog = list.size();
                    double tmaDepto = (rendimientoDeptos.containsKey(depto)) ? (double) rendimientoDeptos.get(depto).get("trabajo") : 300.0;
                    s.put("depto", depto);
                    s.put("backlog", backlog);
                    s.put("tma", tmaDepto);
                    s.put("retrasoEstimadoSegundos", backlog * tmaDepto);
                    s.put("nivelSaturacion", backlog > 10 ? "ALTO" : (backlog > 5 ? "MEDIO" : "BAJO"));
                    saturationMap.put(depto, s);
                });
        global.put("saturacionActual", saturationMap);

        return global;
    }

    private String calcularTendencia(List<TareaInstancia> tareas) {
        if (tareas.size() < 3) return "ESTABLE";
        
        // Promedio de todas
        double totalAvg = tareas.stream()
            .mapToLong(t -> Duration.between(t.getFechaAtencion() != null ? t.getFechaAtencion() : t.getFechaInicio(), t.getFechaCompletado()).getSeconds())
            .average().orElse(0);
            
        // Promedio de las últimas 3
        double last3Avg = tareas.stream()
            .sorted(Comparator.comparing(TareaInstancia::getFechaCompletado).reversed())
            .limit(3)
            .mapToLong(t -> Duration.between(t.getFechaAtencion() != null ? t.getFechaAtencion() : t.getFechaInicio(), t.getFechaCompletado()).getSeconds())
            .average().orElse(0);

        if (last3Avg < totalAvg * 0.9) return "SUBE"; // Mejora (menos tiempo)
        if (last3Avg > totalAvg * 1.1) return "BAJA"; // Empeora (más tiempo)
        return "ESTABLE";
    }

    public String getResumenIA(String politicaId, String xmlBpmn) {
        return aiOrchestratorService.analyzeBottlenecks(xmlBpmn);
    }

    public Map<String, Double> getTiempoPromedioPorNodo(String politicaId) {
        List<TareaInstancia> tareas = tareaRepository.findAll().stream()
                .filter(t -> politicaId.equals(t.getPoliticaNegocioId()) && "COMPLETADA".equals(t.getEstado()) 
                        && t.getFechaInicio() != null && t.getFechaCompletado() != null)
                .collect(Collectors.toList());

        return tareas.stream()
                .collect(Collectors.groupingBy(TareaInstancia::getNombre,
                        Collectors.averagingDouble(t -> Duration.between(t.getFechaInicio(), t.getFechaCompletado()).getSeconds())));
    }

    public List<Map<String, Object>> getRankingFuncionarios(String politicaId) {
        List<TareaInstancia> tareas = tareaRepository.findAll().stream()
                .filter(t -> politicaId.equals(t.getPoliticaNegocioId()) && "COMPLETADA".equals(t.getEstado()))
                .collect(Collectors.toList());

        Map<String, List<TareaInstancia>> porUsuario = tareas.stream()
                .filter(t -> t.getUsuarioId() != null)
                .collect(Collectors.groupingBy(TareaInstancia::getUsuarioId));

        List<Map<String, Object>> ranking = new ArrayList<>();
        porUsuario.forEach((userId, list) -> {
            usuarioRepository.findById(userId).ifPresent(u -> {
                Map<String, Object> entry = new HashMap<>();
                entry.put("nombre", u.getNombre() + " " + u.getApellido());
                entry.put("avatar", u.getAvatar());
                entry.put("tareasRealizadas", (long) list.size());
                entry.put("tma", list.stream()
                        .mapToLong(t -> Duration.between(t.getFechaAtencion() != null ? t.getFechaAtencion() : t.getFechaInicio(), t.getFechaCompletado()).getSeconds())
                        .average().orElse(0));
                ranking.add(entry);
            });
        });

        ranking.sort((a, b) -> Long.compare((Long) b.get("tareasRealizadas"), (Long) a.get("tareasRealizadas")));
        return ranking;
    }

    public Map<String, Map<String, Object>> getMetricasPorDepartamento(String politicaId) {
        List<TareaInstancia> tareas = tareaRepository.findAll().stream()
                .filter(t -> politicaId.equals(t.getPoliticaNegocioId()) && "COMPLETADA".equals(t.getEstado()))
                .collect(Collectors.toList());

        Map<String, List<TareaInstancia>> porDepto = tareas.stream()
                .collect(Collectors.groupingBy(t -> t.getLaneId() != null ? t.getLaneId().toUpperCase() : "GENERAL"));

        Map<String, Map<String, Object>> metricas = new HashMap<>();
        porDepto.forEach((depto, list) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("espera", list.stream()
                    .mapToLong(t -> t.getFechaAtencion() != null ? Duration.between(t.getFechaInicio(), t.getFechaAtencion()).getSeconds() : 0)
                    .average().orElse(0));
            m.put("trabajo", list.stream()
                    .mapToLong(t -> Duration.between(t.getFechaAtencion() != null ? t.getFechaAtencion() : t.getFechaInicio(), t.getFechaCompletado()).getSeconds())
                    .average().orElse(0));
            m.put("total", (long) list.size());
            metricas.put(depto, m);
        });
        return metricas;
    }
}
