package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.Documento;
import com.uagrm.gestion.tramites.repository.DocumentoRepository;
import com.uagrm.gestion.tramites.service.FormularioService;
import com.uagrm.gestion.tramites.service.S3Service;
import com.uagrm.gestion.tramites.service.VisionService;
import com.uagrm.gestion.tramites.repository.FormularioSchemaRepository;
import com.uagrm.gestion.tramites.model.FormularioSchema;
import com.uagrm.gestion.tramites.model.InstanciaProceso;
import com.uagrm.gestion.tramites.repository.InstanciaProcesoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/documentos")
@RequiredArgsConstructor
public class DocumentoController {

    private final DocumentoRepository documentoRepository;
    private final FormularioService formularioService;
    private final FormularioSchemaRepository schemaRepository;
    private final InstanciaProcesoRepository instanciaRepository;
    private final S3Service s3Service;
    private final VisionService visionService;

    @PostMapping("/subir")
    public ResponseEntity<?> subirDocumento(
            @RequestParam("file") MultipartFile file,
            @RequestParam String clienteCi,
            @RequestParam(required = false) String instanciaId,
            @RequestParam(required = false) String politicaId,
            @RequestParam String tipoDocumento,
            @RequestParam(required = false) String ocrTexto) {
        
        try {
            // Lógica de Blindaje (Fase 1)
            if (instanciaId != null && !instanciaId.isBlank()) {
                Optional<Documento> actual = documentoRepository.findByInstanciaIdAndTipoDocumentoAndEsActualTrue(instanciaId, tipoDocumento);
                if (actual.isPresent()) {
                    Documento viejo = actual.get();
                    // REGLA DE ORO: Solo subir si está OBSERVADO
                    if (!"OBSERVADO".equals(viejo.getEstadoDocumento())) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(Map.of("error", "El documento ya fue enviado y está en revisión. No puede subir una nueva versión hasta que sea observado."));
                    }
                }
            }

            System.out.println(">> [UPLOAD-DEBUG] 1. Iniciando subida a S3...");
            String s3Url = s3Service.subirArchivo(file.getOriginalFilename(), file.getInputStream(), file.getSize(), file.getContentType());
            System.out.println(">> [UPLOAD-DEBUG] S3 OK: " + s3Url);

            System.out.println(">> [UPLOAD-DEBUG] 2. Extrayendo bytes de la imagen...");
            byte[] imageBytes = file.getBytes();
            if (imageBytes == null || imageBytes.length == 0) {
                throw new RuntimeException("Fallo crÃ­tico: Bytes de imagen vacÃ­os tras subida a S3.");
            }
            System.out.println(">> [UPLOAD-DEBUG] Bytes OK. TamaÃ±o: " + imageBytes.length);

            System.out.println(">> [UPLOAD-DEBUG] 3. Consultando IA de VisiÃ³n (Groq/Tesseract)...");
            List<Documento.OcrCoordinate> coords = visionService.analizarImagenReal(imageBytes, tipoDocumento);
            String fullText = visionService.extraerTextoCompleto(coords);
            System.out.println(">> [UPLOAD-DEBUG] VisiÃ³n OK. Texto extraÃ­do: " + (fullText.length() > 50 ? fullText.substring(0, 50) + "..." : fullText));

            // LÃ³gica de Control de Versiones (Fase 2: GenealogÃ­a)

            Documento doc = new Documento();
            List<Documento> historial;

            if (instanciaId != null && !instanciaId.isBlank()) {
                // CASO A: Ya existe un trÃ¡mite. Buscamos versiones SOLO en este trÃ¡mite.
                historial = documentoRepository.findByInstanciaIdAndTipoDocumentoOrderByVersionDesc(instanciaId, tipoDocumento);
            } else {
                // CASO B: TrÃ¡mite nuevo (Orfandad). Buscamos versiones SOLO entre otros documentos huÃ©rfanos del mismo CI.
                // Esto evita que un carnet de un trÃ¡mite de hace meses se considere "versiÃ³n anterior" de un trÃ¡mite nuevo.
                historial = documentoRepository.findByClienteCiAndTipoDocumentoOrderByVersionDesc(clienteCi, tipoDocumento)
                        .stream()
                        .filter(d -> d.getInstanciaId() == null || d.getInstanciaId().isBlank())
                        .collect(java.util.stream.Collectors.toList());
            }

            if (!historial.isEmpty()) {
                // Hay versiones previas dentro del mismo contexto (Instancia o HuÃ©rfanos)
                Documento ultimo = historial.get(0);
                
                // Desactivar anteriores del mismo contexto
                historial.forEach(h -> {
                    if (Boolean.TRUE.equals(h.getEsActual())) {
                        h.setEsActual(false);
                        documentoRepository.save(h);
                    }
                });

                int versionActual = (ultimo.getVersion() != null) ? ultimo.getVersion() : 1;
                doc.setVersion(versionActual + 1);
                doc.setDocumentoPadreId(ultimo.getDocumentoPadreId() != null ? ultimo.getDocumentoPadreId() : ultimo.getId());
            } else {
                // Es un documento totalmente nuevo para este contexto (V1)
                doc.setVersion(1);
                doc.setDocumentoPadreId(null);
            }

            doc.setEsActual(true); // El nuevo siempre manda
            doc.setEstadoDocumento("PENDIENTE");
            doc.setClienteCi(clienteCi);
            doc.setInstanciaId(instanciaId);
            doc.setTipoDocumento(tipoDocumento);
            doc.setOcrTexto(fullText);
            doc.setCoordenadas(coords);
            doc.setFechaSubida(Instant.now());
            doc.setNombreArchivo(file.getOriginalFilename());
            doc.setUrlS3(s3Url);

            return ResponseEntity.ok(documentoRepository.save(doc));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/cliente/{ci}")
    public ResponseEntity<List<Documento>> listarPorCliente(
            @PathVariable String ci, 
            @RequestParam(required = false) String instanciaId) {
        
        if (instanciaId != null && !instanciaId.isBlank()) {
            // SOLO documentos de este trÃ¡mite especÃ­fico
            return ResponseEntity.ok(documentoRepository.findByInstanciaId(instanciaId));
        } else {
            // SOLO documentos huÃ©rfanos (para cuando el trÃ¡mite aÃºn no se ha guardado en motor)
            List<Documento> huerfanos = documentoRepository.findByClienteCi(ci).stream()
                    .filter(d -> d.getInstanciaId() == null || d.getInstanciaId().isBlank())
                    .collect(java.util.stream.Collectors.toList());
            return ResponseEntity.ok(huerfanos);
        }
    }

    @PostMapping("/procesar-voz-contexto")
    public ResponseEntity<String> procesarVozContexto(@RequestBody Map<String, String> payload) {
        String politicaId = payload.get("politicaId");
        String taskId = payload.get("taskId");
        String clienteCi = payload.get("clienteCi");
        String voiceInstruction = payload.get("voiceInstruction");
        String instanciaId = payload.get("instanciaId"); // RECIBIR ID DE INSTANCIA

        Optional<FormularioSchema> schema = (taskId != null && !taskId.isBlank()) 
            ? schemaRepository.findByPoliticaIdAndTaskDefinitionId(politicaId, taskId.toLowerCase())
            : schemaRepository.findByPoliticaId(politicaId).stream().findFirst();

        if (schema.isEmpty()) return ResponseEntity.notFound().build();

        // FILTRO ESTRICTO: Solo documentos de este trÃ¡mite (o huÃ©rfanos si es nuevo)
        List<Documento> documentos;
        if (instanciaId != null && !instanciaId.isBlank()) {
            documentos = documentoRepository.findByInstanciaId(instanciaId);
        } else {
            documentos = documentoRepository.findByClienteCi(clienteCi).stream()
                .filter(d -> d.getInstanciaId() == null || d.getInstanciaId().isBlank())
                .collect(java.util.stream.Collectors.toList());
        }
        
        // PASO 1: ExtracciÃ³n RÃ¡pida de Texto
        String prediction = formularioService.obtenerPrediccionRapida(schema.get().getSchemaJson(), documentos, voiceInstruction);
        
        return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(prediction);
    }

    @PostMapping("/obtener-evidencias-ia")
    public ResponseEntity<String> obtenerEvidencias(@RequestBody Map<String, Object> payload) {
        String jsonResult = (String) payload.get("jsonResult");
        String clienteCi = (String) payload.get("clienteCi");
        String instanciaId = (String) payload.get("instanciaId"); // RECIBIR ID DE INSTANCIA
        
        List<Documento> documentos;
        if (instanciaId != null && !instanciaId.isBlank()) {
            documentos = documentoRepository.findByInstanciaId(instanciaId);
        } else {
            documentos = documentoRepository.findByClienteCi(clienteCi).stream()
                .filter(d -> d.getInstanciaId() == null || d.getInstanciaId().isBlank())
                .collect(java.util.stream.Collectors.toList());
        }

        String evidencias = formularioService.obtenerCoordenadasParaCampos(jsonResult, documentos);
        
        return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(evidencias);
    }

    @PostMapping("/{id}/observar")
    public ResponseEntity<?> observarDocumento(@PathVariable String id, @RequestBody Map<String, String> payload) {
        return documentoRepository.findById(id).map(doc -> {
            String motivo = payload.get("motivo");
            doc.setEstadoDocumento("OBSERVADO");
            doc.setMotivoObservacion(motivo);
            documentoRepository.save(doc);

            // Intentar notificar al cliente (FCM)
            try {
                // Buscamos el token del dispositivo del usuario asociado a este CI (si existe)
                // Nota: En una fase posterior vincularemos CI con Usuario más estrictamente
                // Por ahora enviamos log de simulacro de notificación
                System.out.println("📢 [NOTIFICACIÓN] Enviando alerta a CI: " + doc.getClienteCi() + " -> Documento " + doc.getTipoDocumento() + " OBSERVADO: " + motivo);
            } catch (Exception e) {
                e.printStackTrace();
            }

            return ResponseEntity.ok(doc);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/aprobar")
    public ResponseEntity<?> aprobarDocumento(@PathVariable String id) {
        return documentoRepository.findById(id).map(doc -> {
            doc.setEstadoDocumento("APROBADO");
            doc.setMotivoObservacion(null);
            return ResponseEntity.ok(documentoRepository.save(doc));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/versiones")
    public ResponseEntity<List<Documento>> listarVersiones(@PathVariable String id) {
        return documentoRepository.findById(id).map(doc -> {
            String padreId = doc.getDocumentoPadreId() != null ? doc.getDocumentoPadreId() : doc.getId();
            return ResponseEntity.ok(documentoRepository.findAllByDocumentoPadreIdOrIdOrderByVersionDesc(padreId, padreId));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/colaborativo/guardar")
    public ResponseEntity<Documento> guardarDocumentoColaborativo(@RequestBody Map<String, Object> payload) {
        String instanciaId = (String) payload.get("instanciaId");
        String nombreArchivo = (String) payload.get("nombreArchivo");
        String contenidoHtml = (String) payload.get("contenidoHtml");
        String userEmail = (String) payload.get("userEmail");
        String deptoNombre = (String) payload.get("departamentoNombre");
        String funcionarioNombre = (String) payload.get("funcionarioNombre");
        String clienteCi = (String) payload.get("clienteCi");

        // Buscar si ya existe una versión de este documento (por nombre y instancia)
        Optional<Documento> actualOpt = documentoRepository.findByInstanciaIdAndNombreArchivoAndEsActualTrue(instanciaId, nombreArchivo);
        
        Documento nuevo = new Documento();
        nuevo.setInstanciaId(instanciaId);
        nuevo.setNombreArchivo(nombreArchivo);
        nuevo.setTipoDocumento("GESTION_FUNCIONARIO");
        nuevo.setContenidoHtml(contenidoHtml);
        nuevo.setEsColaborativo(true);
        nuevo.setFechaSubida(Instant.now());
        nuevo.setEstadoDocumento("APROBADO"); // Los de funcionario nacen aprobados
        nuevo.setCreadoPorFuncionarioId(userEmail);
        nuevo.setFuncionarioNombre(funcionarioNombre);
        nuevo.setDepartamentoNombre(deptoNombre);
        nuevo.setClienteCi(clienteCi);

        if (actualOpt.isPresent()) {
            Documento viejo = actualOpt.get();
            viejo.setEsActual(false);
            documentoRepository.save(viejo);
            
            nuevo.setDocumentoPadreId(viejo.getDocumentoPadreId() != null ? viejo.getDocumentoPadreId() : viejo.getId());
            nuevo.setVersion(viejo.getVersion() + 1);
        } else {
            nuevo.setVersion(1);
            nuevo.setEsActual(true);
        }
        
        nuevo.setEsActual(true);
        return ResponseEntity.ok(documentoRepository.save(nuevo));
    }

    @PostMapping("/{id}/restaurar")
    public ResponseEntity<Documento> restaurarVersion(@PathVariable String id, @RequestParam String userEmail, @RequestParam String funcionarioNombre) {
        return documentoRepository.findById(id).map(versionAntigua -> {
            // Desactivar la versión actual
            String padreId = versionAntigua.getDocumentoPadreId() != null ? versionAntigua.getDocumentoPadreId() : versionAntigua.getId();
            documentoRepository.findByInstanciaIdAndNombreArchivoAndEsActualTrue(versionAntigua.getInstanciaId(), versionAntigua.getNombreArchivo())
                .ifPresent(actual -> {
                    actual.setEsActual(false);
                    documentoRepository.save(actual);
                });

            Documento nueva = new Documento();
            nueva.setInstanciaId(versionAntigua.getInstanciaId());
            nueva.setClienteCi(versionAntigua.getClienteCi());
            nueva.setNombreArchivo(versionAntigua.getNombreArchivo());
            nueva.setTipoDocumento(versionAntigua.getTipoDocumento());
            nueva.setContenidoHtml(versionAntigua.getContenidoHtml());
            nueva.setEsColaborativo(true);
            nueva.setEsActual(true);
            nueva.setFechaSubida(Instant.now());
            nueva.setDocumentoPadreId(padreId);
            nueva.setCreadoPorFuncionarioId(userEmail);
            nueva.setFuncionarioNombre(funcionarioNombre + " (Restaurado de V" + versionAntigua.getVersion() + ")");
            nueva.setDepartamentoNombre(versionAntigua.getDepartamentoNombre());
            
            // Calcular nueva versión
            Integer maxV = documentoRepository.findAllByDocumentoPadreIdOrIdOrderByVersionDesc(padreId, padreId)
                    .stream().mapToInt(Documento::getVersion).max().orElse(1);
            nueva.setVersion(maxV + 1);

            return ResponseEntity.ok(documentoRepository.save(nueva));
        }).orElse(ResponseEntity.notFound().build());
    }
}
