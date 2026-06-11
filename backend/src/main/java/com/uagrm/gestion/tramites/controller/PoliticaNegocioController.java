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
    private final com.uagrm.gestion.tramites.service.AuditoriaService auditoriaService;
    private final com.uagrm.gestion.tramites.repository.DocumentoRepository documentoRepository;

    @PostMapping("/procesar-documento")
    public ResponseEntity<List<PoliticaNegocio>> procesarDocumento(@RequestParam("archivo") MultipartFile archivo) throws IOException {
        auditoriaService.registrar(null, null, "GENERAR_IA_PDF", "DISEÑADOR", "PDF", "Archivo: " + archivo.getOriginalFilename());
        
        // 1. Persistir el documento origen (PDF) para trazabilidad
        com.uagrm.gestion.tramites.model.Documento doc = new com.uagrm.gestion.tramites.model.Documento();
        doc.setNombreArchivo(archivo.getOriginalFilename());
        doc.setTipoDocumento("ORIGEN_POLITICA");
        doc.setFechaSubida(java.time.Instant.now());
        doc.setUrlS3("s3://tramites-uagrm/disenos/" + archivo.getOriginalFilename()); // Mock S3
        doc = documentoRepository.save(doc);

        String texto = documentProcessorService.extractTextFromPdf(archivo);
        return ResponseEntity.ok(generarPoliticasDesdeTexto(texto, "PDF", doc.getId()));
    }

    @PostMapping("/texto")
    public ResponseEntity<List<PoliticaNegocio>> procesarTexto(@RequestBody Map<String, String> payload) {
        auditoriaService.registrar(null, null, "GENERAR_IA_PROMPT", "DISEÑADOR", "PROMPT", "Generación por texto manual");
        String texto = payload.get("texto");
        if (texto == null || texto.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(generarPoliticasDesdeTexto(texto, "PROMPT", null));
    }

    private List<PoliticaNegocio> generarPoliticasDesdeTexto(String texto, String origenTipo, String docId) {
        // ETAPA 1: DESCUBRIMIENTO (Censo de procesos y fragmentos)
        List<Map<String, String>> descubrimientos = aiOrchestratorService.discoverProcesses(texto, origenTipo);
        List<PoliticaNegocio> politicasGeneradas = new ArrayList<>();

        log.info("Iniciando orquestación atómica para {} trámites detectados.", descubrimientos.size());

        for (Map<String, String> disc : descubrimientos) {
            String nombre = disc.get("nombre");
            String fragmento = disc.get("fragmento");

            try {
                // Pequeño retardo para evitar saturar la API
                if (!politicasGeneradas.isEmpty()) Thread.sleep(2000); 

                log.info("Generando XML UML para: {}", nombre);
                
                // ETAPA 2: GENERACIÓN ATÓMICA (XML Puro por proceso)
                String xml = aiOrchestratorService.generatePureUmlXml(nombre, fragmento);
                
                if (xml == null || xml.isBlank()) {
                    log.warn("XML vacío para {}, reintentando con contexto completo...", nombre);
                    xml = aiOrchestratorService.generatePureUmlXml(nombre, texto);
                }

                if (xml != null && !xml.isBlank()) {
                    PoliticaNegocio nuevaPolitica = new PoliticaNegocio();
                    nuevaPolitica.setNombre(nombre);
                    nuevaPolitica.setXmlBpmn(xml);
                    nuevaPolitica.setEstado(EstadoPolitica.BORRADOR);
                    
                    // ADN del Proceso (Para TensorFlow y Trazabilidad)
                    nuevaPolitica.setOrigenTipo(origenTipo);
                    nuevaPolitica.setOrigenContenido(fragmento);
                    nuevaPolitica.setDocumentoOrigenId(docId);
                    
                    // Descripción técnica básica
                    nuevaPolitica.setDescripcion("Proceso de " + nombre + " orquestado automáticamente desde " + origenTipo + ".");
                    
                    politicasGeneradas.add(nuevaPolitica);
                    log.info("✅ Trámite '{}' completado.", nombre);
                }

            } catch (Exception e) {
                log.error("Fallo en orquestación de {}: {}", nombre, e.getMessage());
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
        service.actualizarXml(id, xml, "DISEÑADOR");
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
    public ResponseEntity<PoliticaNegocio> restaurarVersion(@PathVariable String id, @PathVariable String versionId, @RequestParam(required = false) String autor) {
        return ResponseEntity.ok(service.restaurarVersion(id, versionId, autor));
    }
}
