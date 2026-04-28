package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.MacroProceso;
import com.uagrm.gestion.tramites.model.MacroProcesoPaso;
import com.uagrm.gestion.tramites.repository.MacroProcesoPasoRepository;
import com.uagrm.gestion.tramites.repository.MacroProcesoRepository;
import com.uagrm.gestion.tramites.service.MacroProcesoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/macroprocesos")
@RequiredArgsConstructor
public class MacroProcesoController {

    private final MacroProcesoRepository repository;
    private final MacroProcesoPasoRepository pasoRepository;
    private final MacroProcesoService service;

    @GetMapping
    public List<MacroProceso> listar() {
        return repository.findAll();
    }

    @PostMapping
    public MacroProceso crear(@RequestBody MacroProceso mp) {
        return repository.save(mp);
    }

    @PostMapping("/{id}/pasos")
    public MacroProcesoPaso agregarPaso(@PathVariable String id, @RequestBody MacroProcesoPaso paso) {
        paso.setMacroprocesoId(id);
        return pasoRepository.save(paso);
    }

    @GetMapping("/{id}/pasos")
    public List<MacroProcesoPaso> listarPasos(@PathVariable String id) {
        return pasoRepository.findAll().stream()
                .filter(p -> p.getMacroprocesoId().equals(id))
                .toList();
    }

    @PostMapping("/{id}/iniciar")
    public ResponseEntity<Void> iniciar(@PathVariable String id, @RequestBody Map<String, String> payload) {
        service.iniciarMacroProceso(id, payload.get("xmlBpmn"), payload.get("politicaInicialId"), payload.get("solicitante"));
        return ResponseEntity.ok().build();
    }
}
