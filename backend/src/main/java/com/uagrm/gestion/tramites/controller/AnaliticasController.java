package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.PoliticaNegocio;
import com.uagrm.gestion.tramites.service.AnaliticasService;
import com.uagrm.gestion.tramites.service.PoliticaNegocioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analiticas")
@RequiredArgsConstructor
public class AnaliticasController {

    private final AnaliticasService service;
    private final PoliticaNegocioService politicaService;

    @GetMapping("/global")
    public ResponseEntity<Map<String, Object>> getGlobal() {
        return ResponseEntity.ok(service.getMetricasGlobales());
    }

    @GetMapping("/{id}/tiempos-por-nodo")
    public ResponseEntity<Map<String, Double>> getTiempos(@PathVariable String id) {
        return ResponseEntity.ok(service.getTiempoPromedioPorNodo(id));
    }

    @GetMapping("/{id}/ranking-funcionarios")
    public ResponseEntity<List<Map<String, Object>>> getRanking(@PathVariable String id) {
        return ResponseEntity.ok(service.getRankingFuncionarios(id));
    }

    @GetMapping("/{id}/departamentos")
    public ResponseEntity<Map<String, Map<String, Object>>> getDeptos(@PathVariable String id) {
        return ResponseEntity.ok(service.getMetricasPorDepartamento(id));
    }

    @GetMapping("/{id}/resumen")
    public ResponseEntity<Map<String, String>> getResumen(@PathVariable String id) {
        PoliticaNegocio p = politicaService.obtenerPorId(id).orElseThrow();
        return ResponseEntity.ok(Map.of("analisis", service.getResumenIA(id, p.getXmlBpmn())));
    }
}
