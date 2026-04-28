package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.EstadoPolitica;
import com.uagrm.gestion.tramites.model.PoliticaNegocio;
import com.uagrm.gestion.tramites.model.VersionPolitica;
import com.uagrm.gestion.tramites.service.AIOrchestratorService;
import com.uagrm.gestion.tramites.service.DocumentProcessorService;
import com.uagrm.gestion.tramites.service.PoliticaNegocioService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/politicas")
@RequiredArgsConstructor
public class PoliticaNegocioController {

    private static final Logger log = LoggerFactory.getLogger(PoliticaNegocioController.class);
    private final PoliticaNegocioService service;
    private final DocumentProcessorService documentProcessorService;
    private final AIOrchestratorService aiOrchestratorService;

    @PostMapping("/procesar-documento")
    public ResponseEntity<List<PoliticaNegocio>> procesarDocumento(@RequestParam("archivo") MultipartFile archivo) throws IOException {
        String texto = documentProcessorService.extractTextFromPdf(archivo);
        return ResponseEntity.ok(generarPoliticasDesdeTexto(texto, archivo.getOriginalFilename()));
    }

    @PostMapping("/texto")
    public ResponseEntity<List<PoliticaNegocio>> procesarTexto(@RequestBody Map<String, String> payload) {
        String texto = payload.get("texto");
        if (texto == null || texto.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(generarPoliticasDesdeTexto(texto, "texto manual"));
    }

    private List<PoliticaNegocio> generarPoliticasDesdeTexto(String texto, String fuente) {
        List<String> nombresProcesos = aiOrchestratorService.analyzeAndExtractProcesses(texto);
        List<PoliticaNegocio> politicasGeneradas = new ArrayList<>();

        log.info("Iniciando generación masiva para {} procesos detectados.", nombresProcesos.size());

        for (String nombre : nombresProcesos) {
            try {
                // FASE 1: Pausa de cortesía para evitar Rate Limits de la API
                if (!politicasGeneradas.isEmpty()) {
                    log.info("Esperando 2 segundos para la siguiente solicitud a la IA...");
                    Thread.sleep(2500); 
                }

                log.info("Generando diagrama para: {}", nombre);
                String xml = aiOrchestratorService.generateBPMNXml(nombre, texto);
                
                if (xml == null || xml.isBlank()) {
                    log.warn("La IA devolvió un XML vacío para {}, reintentando una vez...", nombre);
                    Thread.sleep(3000);
                    xml = aiOrchestratorService.generateBPMNXml(nombre, texto);
                }

                if (xml != null && !xml.isBlank()) {
                    PoliticaNegocio nuevaPolitica = new PoliticaNegocio();
                    nuevaPolitica.setNombre(nombre);
                    nuevaPolitica.setDescripcion("Generado automáticamente por IA Orchestrator.");
                    nuevaPolitica.setXmlBpmn(xml);
                    nuevaPolitica.setEstado(EstadoPolitica.BORRADOR);
                    
                    politicasGeneradas.add(nuevaPolitica);
                    log.info("Proceso {} generado (en memoria).", nombre);
                }

            } catch (Exception e) {
                log.error("Fallo crítico al generar el proceso {}: {}", nombre, e.getMessage());
            }
        }
        return politicasGeneradas;
    }

    @PostMapping
    public ResponseEntity<PoliticaNegocio> crear(@RequestBody PoliticaNegocio politica) {
        return ResponseEntity.ok(service.crear(politica));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PoliticaNegocio> actualizar(@PathVariable String id, @RequestBody PoliticaNegocio politica) {
        politica.setId(id);
        return ResponseEntity.ok(service.guardarOActualizar(politica));
    }

    @GetMapping
    public ResponseEntity<List<PoliticaNegocio>> listar() {
        List<PoliticaNegocio> todas = service.listarTodas();
        return ResponseEntity.ok(todas);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PoliticaNegocio> obtener(@PathVariable String id) {
        return service.obtenerPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        service.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/activar")
    public ResponseEntity<Map<String, Object>> activar(@PathVariable String id) {
        return ResponseEntity.ok(service.activarPolitica(id));
    }

    @PostMapping("/{id}/archivar")
    public ResponseEntity<PoliticaNegocio> archivar(@PathVariable String id) {
        return ResponseEntity.ok(service.archivarPolitica(id));
    }

    @PutMapping("/{id}/xml")
    public ResponseEntity<Void> guardarXml(@PathVariable String id, @RequestBody String xml) {
        service.actualizarXml(id, xml);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/resincronizar-todo")
    public ResponseEntity<Map<String, Object>> resincronizarTodo() {
        return ResponseEntity.ok(service.resincronizarTodo());
    }

    @PostMapping("/{id}/editar-con-ia")
    public ResponseEntity<Map<String, String>> editarConIA(@PathVariable String id, @RequestBody Map<String, String> payload) {
        PoliticaNegocio p = service.obtenerPorId(id).orElseThrow();
        String instruccion = payload.get("instruccion");
        String nuevoXml = aiOrchestratorService.editBPMNXml(p.getXmlBpmn(), instruccion);
        return ResponseEntity.ok(Map.of("xml", nuevoXml));
    }

    @GetMapping("/{id}/versiones")
    public ResponseEntity<List<VersionPolitica>> listarVersiones(@PathVariable String id) {
        return ResponseEntity.ok(service.listarVersiones(id));
    }

    @PostMapping("/{id}/versiones/{versionId}/restaurar")
    public ResponseEntity<PoliticaNegocio> restaurarVersion(@PathVariable String id, @PathVariable String versionId) {
        return ResponseEntity.ok(service.restaurarVersion(id, versionId));
    }
}
