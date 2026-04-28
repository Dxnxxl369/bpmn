package com.uagrm.gestion.tramites.service;

import com.uagrm.gestion.tramites.model.EstadisticaTarea;
import com.uagrm.gestion.tramites.repository.EstadisticaTareaRepository;
import com.uagrm.gestion.tramites.repository.UsuarioRepository;
import com.uagrm.gestion.tramites.repository.DepartamentoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnaliticasService {

    private final EstadisticaTareaRepository repository;
    private final AIOrchestratorService aiOrchestratorService;
    private final UsuarioRepository usuarioRepository;
    private final DepartamentoRepository departamentoRepository;

    private String normalizar(String texto) {
        if (texto == null || texto.isEmpty()) return "";
        String n = Normalizer.normalize(texto, Normalizer.Form.NFD);
        return n.replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9]", "")
                .trim();
    }

    public Map<String, Double> getTiempoPromedioPorNodo(String politicaId) {
        List<EstadisticaTarea> stats = repository.findByPoliticaNegocioId(politicaId);
        return stats.stream()
                .collect(Collectors.groupingBy(
                        EstadisticaTarea::getNodoNombre,
                        Collectors.averagingDouble(s -> {
                            long t = s.getEjecucionSegundos() != null && s.getEjecucionSegundos() > 0 ? s.getEjecucionSegundos() : 
                                     (s.getDuracionSegundos() != null ? s.getDuracionSegundos() : 0);
                            return (double) t;
                        })
                ));
    }

    public Map<String, Map<String, Object>> getMetricasPorDepartamento(String politicaId) {
        List<EstadisticaTarea> stats = repository.findByPoliticaNegocioId(politicaId);
        
        return stats.stream()
            .collect(Collectors.groupingBy(
                s -> s.getLaneId() != null ? s.getLaneId().toUpperCase() : "GENERAL",
                Collectors.collectingAndThen(
                    Collectors.toList(),
                    list -> {
                        Map<String, Object> metrics = new HashMap<>();
                        metrics.put("esperaPromedio", list.stream().mapToLong(s -> s.getEsperaSegundos() != null ? s.getEsperaSegundos() : 0).average().orElse(0));
                        metrics.put("ejecucionPromedio", list.stream().mapToLong(s -> {
                            long exec = s.getEjecucionSegundos() != null && s.getEjecucionSegundos() > 0 ? s.getEjecucionSegundos() : 
                                        (s.getDuracionSegundos() != null ? s.getDuracionSegundos() : 0);
                            return exec;
                        }).average().orElse(0));
                        metrics.put("totalCompletadas", (long) list.size());
                        return metrics;
                    }
                )
            ));
    }

    public List<Map<String, Object>> getRankingFuncionarios(String politicaId) {
        List<EstadisticaTarea> stats = repository.findByPoliticaNegocioId(politicaId);
        
        // Agrupamos por ID de usuario para mayor precisión, fallback a nombre
        Map<String, List<EstadisticaTarea>> porUsuario = stats.stream()
                .filter(s -> s.getUsuarioId() != null || (s.getUsuarioNombre() != null && !s.getUsuarioNombre().isEmpty()))
                .collect(Collectors.groupingBy(s -> s.getUsuarioId() != null ? s.getUsuarioId() : s.getUsuarioNombre()));

        return porUsuario.entrySet().stream()
                .map(e -> {
                    Map<String, Object> map = new HashMap<>();
                    List<EstadisticaTarea> userStats = e.getValue();
                    
                    // Intentamos obtener el nombre más descriptivo disponible
                    String nombre = userStats.stream()
                        .map(EstadisticaTarea::getUsuarioNombre)
                        .filter(n -> n != null && !n.isEmpty())
                        .findFirst()
                        .orElse(e.getKey()); // Fallback al ID si no hay nombre

                    double avg = userStats.stream()
                        .mapToLong(s -> {
                            long t = s.getEjecucionSegundos() != null && s.getEjecucionSegundos() > 0 ? s.getEjecucionSegundos() : 
                                     (s.getDuracionSegundos() != null ? s.getDuracionSegundos() : 0);
                            return t;
                        }).average().orElse(0);
                    
                    map.put("nombre", nombre);
                    map.put("promedioEjecucion", avg);
                    map.put("tareasRealizadas", (long) userStats.size());
                    return map;
                })
                .sorted(Comparator.comparingDouble(m -> (Double) m.get("promedioEjecucion")))
                .collect(Collectors.toList());
    }

    public Map<String, Object> getMetricasGlobales() {
        List<EstadisticaTarea> allStats = repository.findAll();
        Map<String, Object> global = new HashMap<>();
        
        global.put("totalTareas", (long) allStats.size());
        global.put("esperaPromedioGlobal", allStats.stream().mapToLong(s -> s.getEsperaSegundos() != null ? s.getEsperaSegundos() : 0).average().orElse(0));
        global.put("ejecucionPromedioGlobal", allStats.stream().mapToLong(s -> {
            long t = s.getEjecucionSegundos() != null && s.getEjecucionSegundos() > 0 ? s.getEjecucionSegundos() : 
                     (s.getDuracionSegundos() != null ? s.getDuracionSegundos() : 0);
            return t;
        }).average().orElse(0));
        
        String deptoLento = allStats.stream()
            .collect(Collectors.groupingBy(s -> s.getLaneId() != null ? s.getLaneId().toUpperCase() : "GENERAL", 
                Collectors.averagingDouble(s -> s.getEsperaSegundos() != null ? s.getEsperaSegundos() : 0)))
            .entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("Ventanilla");
            
        global.put("cuelloCritico", deptoLento);
        
        String mejorFunc = allStats.stream()
            .filter(s -> s.getUsuarioNombre() != null)
            .collect(Collectors.groupingBy(EstadisticaTarea::getUsuarioNombre, 
                Collectors.averagingDouble(s -> {
                    long t = s.getEjecucionSegundos() != null && s.getEjecucionSegundos() > 0 ? s.getEjecucionSegundos() : 
                             (s.getDuracionSegundos() != null ? s.getDuracionSegundos() : 0);
                    return (double) t;
                })))
            .entrySet().stream()
            .min(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("N/A");
            
        global.put("mejorFuncionario", mejorFunc);

        // --- LÓGICA DE RANKING ROBUSTA (MODO EXPERTO) ---
        List<Map<String, Object>> rankingAgrupado = new ArrayList<>();
        List<com.uagrm.gestion.tramites.model.Usuario> todosUsuarios = usuarioRepository.findAll();

        todosUsuarios.stream()
            .filter(u -> "FUNCIONARIO".equals(u.getRol()))
            .forEach(u -> {
                String full = ((u.getNombre() != null ? u.getNombre() : "") + " " + (u.getApellido() != null ? u.getApellido() : "")).trim();
                String fullNorm = normalizar(full);
                String userNorm = normalizar(u.getUsername());
                String emailNorm = normalizar(u.getEmail());
                
                // Filtrado con lógica de coincidencia múltiple
                List<EstadisticaTarea> susStats = allStats.stream()
                    .filter(s -> {
                        if (u.getId().equals(s.getUsuarioId())) return true;
                        if (s.getUsuarioNombre() == null || s.getUsuarioNombre().isEmpty()) return false;
                        String sNameNorm = normalizar(s.getUsuarioNombre());
                        return sNameNorm.equals(fullNorm) || sNameNorm.equals(userNorm) || sNameNorm.equals(emailNorm);
                    })
                    .collect(Collectors.toList());

                Map<String, Object> execEntry = new HashMap<>();
                execEntry.put("id", u.getId());
                execEntry.put("nombre", full.isEmpty() ? u.getUsername() : full);
                execEntry.put("avatar", u.getAvatar());
                
                List<Map<String, Object>> deptos = new ArrayList<>();
                susStats.stream()
                    .collect(Collectors.groupingBy(s -> s.getLaneId() != null ? s.getLaneId().toUpperCase() : "GENERAL"))
                    .forEach((lane, laneList) -> {
                        Map<String, Object> d = new HashMap<>();
                        d.put("depto", lane);
                        d.put("total", (long) laneList.size());
                        double avg = laneList.stream().mapToLong(s -> {
                            long ex = s.getEjecucionSegundos() != null && s.getEjecucionSegundos() > 0 ? s.getEjecucionSegundos() : 
                                     (s.getDuracionSegundos() != null ? s.getDuracionSegundos() : 0);
                            return ex;
                        }).average().orElse(0);
                        d.put("promedio", avg);
                        deptos.add(d);
                    });
                
                execEntry.put("departamentos", deptos);
                
                // --- PUNTO 1: TMA Y REACCIÓN ---
                double globalAvg = susStats.stream().mapToLong(s -> {
                    long ex = s.getEjecucionSegundos() != null && s.getEjecucionSegundos() > 0 ? s.getEjecucionSegundos() : 
                             (s.getDuracionSegundos() != null ? s.getDuracionSegundos() : 0);
                    return ex;
                }).average().orElse(0);

                double avgReaccion = susStats.stream()
                    .mapToLong(s -> s.getEsperaSegundos() != null ? s.getEsperaSegundos() : 0)
                    .average().orElse(0);

                execEntry.put("promedioGlobal", globalAvg);
                execEntry.put("tma", globalAvg);
                execEntry.put("reaccion", avgReaccion);
                execEntry.put("tareasRealizadas", (long) susStats.size());

                // --- PUNTO 3: CONSISTENCIA (DESVIACIÓN ESTÁNDAR) ---
                if (susStats.size() > 1) {
                    double sumSq = susStats.stream().mapToDouble(s -> {
                        long ex = s.getEjecucionSegundos() != null && s.getEjecucionSegundos() > 0 ? s.getEjecucionSegundos() : 
                                 (s.getDuracionSegundos() != null ? s.getDuracionSegundos() : 0);
                        return Math.pow(ex - globalAvg, 2);
                    }).sum();
                    double stdDev = Math.sqrt(sumSq / susStats.size());
                    execEntry.put("consistencia", stdDev); // Menor es más consistente
                } else {
                    execEntry.put("consistencia", 0.0);
                }

                // --- PUNTO 4: ESPECIALIDAD (MASTER EN DEPTO) ---
                String masterDepto = deptos.stream()
                    .max(Comparator.comparingLong(d -> (Long) d.get("total")))
                    .map(d -> (String) d.get("depto"))
                    .orElse("Polivalente");
                execEntry.put("especialidad", masterDepto);

                // --- PUNTO 5: TENDENCIA (SIMULADA CON ÚLTIMAS TAREAS VS PROMEDIO) ---
                if (susStats.size() >= 4) {
                    double ultimas = susStats.stream()
                        .sorted(Comparator.comparing(EstadisticaTarea::getFechaRegistro).reversed())
                        .limit(2)
                        .mapToLong(s -> s.getEjecucionSegundos() != null ? s.getEjecucionSegundos() : 0)
                        .average().orElse(0);
                    execEntry.put("tendencia", ultimas < globalAvg ? "SUBE" : "BAJA"); // Menos tiempo es "SUBE" en eficiencia
                } else {
                    execEntry.put("tendencia", "ESTABLE");
                }

                rankingAgrupado.add(execEntry);
            });

        rankingAgrupado.sort((a, b) -> {
            double avgA = (Double) a.get("promedioGlobal");
            double avgB = (Double) b.get("promedioGlobal");
            long tasksA = (Long) a.get("tareasRealizadas");
            long tasksB = (Long) b.get("tareasRealizadas");

            if (tasksA == 0 && tasksB == 0) return 0;
            if (tasksA == 0) return 1;
            if (tasksB == 0) return -1;
            return Double.compare(avgA, avgB);
        });
        global.put("rankingGlobal", rankingAgrupado);

        Map<String, Map<String, Object>> rendimientoDeptos = allStats.stream()
            .collect(Collectors.groupingBy(
                s -> s.getLaneId() != null ? s.getLaneId().toUpperCase() : "GENERAL",
                Collectors.collectingAndThen(
                    Collectors.toList(),
                    list -> {
                        Map<String, Object> m = new HashMap<>();
                        m.put("espera", list.stream().mapToLong(s -> s.getEsperaSegundos() != null ? s.getEsperaSegundos() : 0).average().orElse(0));
                        m.put("trabajo", list.stream().mapToLong(s -> {
                            long exec = s.getEjecucionSegundos() != null && s.getEjecucionSegundos() > 0 ? s.getEjecucionSegundos() : 
                                        (s.getDuracionSegundos() != null ? s.getDuracionSegundos() : 0);
                            return exec;
                        }).average().orElse(0));
                        return m;
                    }
                )
            ));
        global.put("rendimientoDeptos", rendimientoDeptos);

        Map<Integer, Long> trafico = allStats.stream()
            .filter(s -> s.getFechaRegistro() != null)
            .collect(Collectors.groupingBy(
                s -> s.getFechaRegistro().getHour(),
                Collectors.counting()
            ));
        
        List<Long> serieTrafico = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            serieTrafico.add(trafico.getOrDefault(i, 0L));
        }
        global.put("serieTrafico", serieTrafico);
        
        return global;
    }

    public String getResumenIA(String politicaId, String xmlBpmn) {
        Map<String, Double> tiempos = getTiempoPromedioPorNodo(politicaId);
        StringBuilder dataReal = new StringBuilder("\nDATOS REALES DE EJECUCIÓN:\n");
        tiempos.forEach((nodo, tiempo) -> dataReal.append("- ").append(nodo).append(": ").append(tiempo).append("s\n"));

        return aiOrchestratorService.analyzeBottlenecks(xmlBpmn + dataReal.toString());
    }
}
