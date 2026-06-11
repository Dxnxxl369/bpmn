package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.Departamento;
import com.uagrm.gestion.tramites.service.DepartamentoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/departamentos")
@RequiredArgsConstructor
public class DepartamentoController {

    private final DepartamentoService service;

    @GetMapping
    public ResponseEntity<List<Departamento>> listar() {
        return ResponseEntity.ok(service.listarTodos());
    }

    @PostMapping
    public ResponseEntity<Departamento> guardarOActualizar(@RequestBody Departamento departamento) {
        return ResponseEntity.ok(service.guardar(departamento));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        service.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
