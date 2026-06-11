package com.uagrm.gestion.tramites.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uagrm.gestion.tramites.model.Documento;
import com.uagrm.gestion.tramites.model.InstanciaProceso;
import com.uagrm.gestion.tramites.repository.DocumentoRepository;
import com.uagrm.gestion.tramites.repository.InstanciaProcesoRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.text.Normalizer;

@Service
@RequiredArgsConstructor
public class FormularioService {

    private static final Logger log = LoggerFactory.getLogger(FormularioService.class);
    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final VisionService visionService;
    private final DocumentoRepository documentoRepository;
    private final InstanciaProcesoRepository instanciaRepository;
    private final S3Service s3Service;

    @Value("${groq.api.key}")
    private String apiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL    = "llama-3.3-70b-versatile";

    public String generateFormFields(String taskName, String taskDocumentation, String processContext, List<String> decisionOptions) {
        log.info(">> [IA-FORM-DEBUG] Generando campos para: {}", taskName);
        String systemPrompt = "Eres un Arquitecto de UI. Genera un ARRAY JSON de campos {id, label, type, required, options}. Sin explicaciones.";
        String userPrompt = String.format("Tarea: [%s]. Contexto: [%s]", taskName, processContext);
        try {
            String raw = callGroq(userPrompt, systemPrompt);
            return cleanJsonResponse(raw);
        } catch (Exception e) { return "[]"; }
    }

    public String obtenerPrediccionRapida(String schemaJson, List<Documento> documentos, String voiceInstruction) {
        log.info(">> [IA-ORQUESTADOR-DEBUG] Iniciando procesamiento rápido.");
        String cleanSchema = simplifySchema(schemaJson);
        StringBuilder fullText = new StringBuilder();

        for (Documento doc : documentos) {
            String text = doc.getOcrTexto();
            if (text == null || text.equals("EXTRACCIÓN PENDIENTE IA") || text.length() < 10) {
                byte[] fileBytes = s3Service.descargarArchivo(doc.getUrlS3());
                if (fileBytes != null) {
                    text = visionService.extraerTextoArchivo(fileBytes, doc.getNombreArchivo());
                    doc.setOcrTexto(text);
                    documentoRepository.save(doc);
                }
            }
            if (text != null) fullText.append("\n--- ").append(doc.getNombreArchivo()).append(" ---\n").append(text);
        }

        String systemPrompt = """
            Eres un motor de extracción de datos. 
            Genera un JSON: {id: {valor, fragmento, docName}}. 
            REGLAS:
            1. 'valor' es el dato limpio.
            2. 'fragmento' es el texto exacto como aparece en el documento (Ej: "RUN 16.789.012-3").
            3. 'docName' DEBE ser el nombre exacto del archivo (Ej: 'fotito.png'). No inventes nombres.
            """;
        
        String userPrompt = "ESQUEMA:\n" + cleanSchema + "\n\nCONTENIDO:\n" + fullText.toString() + "\n\nVOZ: " + (voiceInstruction != null ? voiceInstruction : "N/A");
        
        try {
            String raw = callGroq(userPrompt, systemPrompt);
            String cleaned = cleanJsonResponse(raw);
            log.info(">> [IA-FAST] Respuesta: {}", cleaned);
            return cleaned;
        } catch (Exception e) { return "{}"; }
    }

    public String obtenerCoordenadasParaCampos(String jsonResult, List<Documento> documentos) {
        log.info(">> [IA-COORDS] Buscando coordenadas...");
        Map<String, Map<String, Object>> response = new HashMap<>();
        try {
            JsonNode root = objectMapper.readTree(jsonResult);
            
            // PROCESAMOS CADA DOCUMENTO
            for (Documento doc : documentos) {
                List<String> termsToFind = new ArrayList<>();
                
                // Recolectamos términos que pertenecen a este documento o genéricos
                root.fields().forEachRemaining(entry -> {
                    JsonNode data = entry.getValue();
                    String docNameInJson = data.path("docName").asText();
                    String valor = data.path("valor").asText();
                    String frag = data.path("fragmento").asText();
                    
                    // Si el docName coincide o está vacío (fallback), buscamos el término
                    if (docNameInJson.isEmpty() || docNameInJson.equalsIgnoreCase(doc.getNombreArchivo()) || documentos.size() == 1) {
                        if (!valor.isEmpty() && !valor.equals("null")) termsToFind.add(valor);
                        if (!frag.isEmpty() && !frag.equals("null") && !frag.equals(valor)) termsToFind.add(frag);
                    }
                });

                if (!termsToFind.isEmpty() && esImagen(doc.getNombreArchivo())) {
                    byte[] bytes = s3Service.descargarArchivo(doc.getUrlS3());
                    if (bytes != null) {
                        List<Documento.OcrCoordinate> coordsFound = visionService.obtenerCoordenadasDirigidas(bytes, termsToFind);
                        if (!coordsFound.isEmpty()) {
                            doc.setCoordenadas(coordsFound);
                            documentoRepository.save(doc);
                            
                            // Mapeamos resultados al response
                            root.fields().forEachRemaining(entry -> {
                                String val = entry.getValue().path("valor").asText();
                                String frag = entry.getValue().path("fragmento").asText();
                                findBestCoordinate(frag, coordsFound)
                                    .or(() -> findBestCoordinate(val, coordsFound))
                                    .ifPresent(c -> {
                                        Map<String, Object> fieldData = new HashMap<>();
                                        fieldData.put("fieldId", entry.getKey());
                                        fieldData.put("coords", Map.of("x", c.getX(), "y", c.getY(), "w", c.getW(), "h", c.getH()));
                                        fieldData.put("docId", doc.getId());
                                        response.put(entry.getKey(), fieldData);
                                    });
                            });
                        }
                    }
                }
            }
            return objectMapper.writeValueAsString(response);
        } catch (Exception e) { return "{}"; }
    }

    private java.util.Optional<Documento.OcrCoordinate> findBestCoordinate(String text, List<Documento.OcrCoordinate> coords) {
        if (text == null || text.length() < 2 || text.equals("null")) return java.util.Optional.empty();
        String normalizedTarget = normalizeText(text);
        return coords.stream().filter(c -> {
            String normalizedCoord = normalizeText(c.getTexto());
            return !normalizedCoord.isEmpty() && (normalizedTarget.contains(normalizedCoord) || normalizedCoord.contains(normalizedTarget));
        }).findFirst();
    }

    private String normalizeText(String text) {
        if (text == null) return "";
        return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("[^\\p{ASCII}]", "").toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private boolean esImagen(String fileName) {
        String name = fileName.toLowerCase();
        return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
    }

    private String simplifySchema(String fullSchema) {
        try {
            JsonNode root = objectMapper.readTree(fullSchema);
            List<Map<String, Object>> simpleFields = new ArrayList<>();
            if (root.isArray()) {
                for (JsonNode field : root) {
                    if ("button".equals(field.path("type").asText())) continue;
                    Map<String, Object> f = new HashMap<>();
                    f.put("id", field.path("id").asText());
                    f.put("label", field.path("label").asText());
                    f.put("type", field.path("type").asText());
                    simpleFields.add(f);
                }
            }
            return objectMapper.writeValueAsString(simpleFields);
        } catch (Exception e) { return fullSchema; }
    }

    private String cleanJsonResponse(String raw) {
        if (raw == null || raw.isBlank()) return "[]";
        
        // 1. Limpieza inicial extrema (BOM, invisibles)
        String result = raw.replace("\uFEFF", "").replaceAll("[\\p{C}]", "").trim();
        
        // 2. Extraer el bloque de código si está envuelto en Markdown
        if (result.contains("```")) {
            int start = result.indexOf("```");
            int end = result.lastIndexOf("```");
            if (end > start + 3) {
                String block = result.substring(start + 3, end).trim();
                // Quitar el lenguaje si existe (ej: ```json)
                if (block.toLowerCase().startsWith("json")) {
                    block = block.substring(4).trim();
                }
                result = block;
            }
        }
        
        // 3. Buscar el primer '[' y el último ']'
        int firstBracket = result.indexOf("[");
        int lastBracket = result.lastIndexOf("]");
        
        if (firstBracket != -1 && lastBracket > firstBracket) {
            // Caso ideal: Tenemos un array definido
            return result.substring(firstBracket, lastBracket + 1).trim();
        }
        
        // 4. Fallback: Si no hay array, buscar el primer '{' y el último '}'
        int firstBrace = result.indexOf("{");
        int lastBrace = result.lastIndexOf("}");
        
        if (firstBrace != -1 && lastBrace >= firstBrace) {
            String content = result.substring(firstBrace, lastBrace + 1).trim();
            // Si hay comas entre objetos pero no hay [], lo envolvemos
            if (content.contains("},") || content.contains("}\n,")) {
                return "[" + content + "]";
            }
            // Si es un solo objeto, también lo envolvemos para que sea una lista
            return "[" + content + "]";
        }
        
        return "[]";
    }

    private String callGroq(String userPrompt, String systemPrompt) throws Exception {
        Map<String, Object> body = Map.of(
            "model", MODEL,
            "messages", List.of(Map.of("role", "system", "content", systemPrompt), Map.of("role", "user", "content", userPrompt)),
            "temperature", 0.1
        );
        String res = restClient.post().uri(GROQ_URL).header("Authorization", "Bearer " + apiKey).header("Content-Type", "application/json").body(body).retrieve().body(String.class);
        return objectMapper.readTree(res).path("choices").get(0).path("message").path("content").asText().trim();
    }

    public String anotarSchemaParaSubsanacion(String schemaJson, String instanciaId) {
        if (instanciaId == null || instanciaId.isBlank()) return schemaJson;
        
        try {
            JsonNode root = objectMapper.readTree(schemaJson);
            if (!root.isArray()) return schemaJson;

            List<Documento> documentos = documentoRepository.findByInstanciaId(instanciaId);
            
            // Cargar el contexto de la instancia para saber qué campos ya tienen valor
            Optional<InstanciaProceso> instanciaOpt = instanciaRepository.findById(instanciaId);
            JsonNode contexto = null;
            Map<String, String> observacionesCampos = new java.util.HashMap<>();
            if (instanciaOpt.isPresent()) {
                InstanciaProceso inst = instanciaOpt.get();
                if (inst.getContextoJson() != null) {
                    contexto = objectMapper.readTree(inst.getContextoJson());
                }
                if (inst.getObservacionesCampos() != null) {
                    observacionesCampos = inst.getObservacionesCampos();
                }
            }

            List<Map<String, Object>> annotatedFields = new ArrayList<>();

            for (JsonNode field : root) {
                Map<String, Object> f = objectMapper.convertValue(field, Map.class);
                String fieldId = field.path("id").asText();
                String type = field.path("type").asText();

                // REGLA 1: Por defecto, si el campo ya tiene valor en el contexto, se bloquea
                if (contexto != null && contexto.has(fieldId)) {
                    String valor = contexto.get(fieldId).asText();
                    if (valor != null && !valor.isBlank() && !"null".equals(valor)) {
                        f.put("readOnly", true);
                    }
                }

                // REGLA 2: Si el campo tiene una OBSERVACIÓN explícita, se desbloquea
                if (observacionesCampos.containsKey(fieldId)) {
                    f.put("readOnly", false);
                    f.put("estado", "OBSERVADO");
                    f.put("motivo", observacionesCampos.get(fieldId));
                }

                // REGLA 3: Lógica específica para archivos (Documentos)
                if ("file".equals(type)) {
                    Optional<Documento> docOpt = documentos.stream()
                        .filter(d -> d.getTipoDocumento().equalsIgnoreCase(fieldId) && d.getEsActual())
                        .findFirst();

                    if (docOpt.isPresent()) {
                        Documento doc = docOpt.get();
                        String estado = doc.getEstadoDocumento();
                        
                        if ("APROBADO".equals(estado)) {
                            f.put("readOnly", true);
                            f.put("estado", "APROBADO");
                        } else if ("OBSERVADO".equals(estado)) {
                            // SI ESTÁ OBSERVADO, SE DESBLOQUEA (Habilita corrección)
                            f.put("readOnly", false);
                            f.put("estado", "OBSERVADO");
                            f.put("motivo", doc.getMotivoObservacion());
                        } else {
                            // PENDIENTE o cualquier otro estado intermedio se bloquea
                            f.put("readOnly", true);
                            f.put("estado", estado);
                        }
                    } else {
                        // Si no hay documento pero el campo es requerido, dejarlo editable
                        f.put("readOnly", false);
                    }
                }
                
                annotatedFields.add(f);
            }
            return objectMapper.writeValueAsString(annotatedFields);
        } catch (Exception e) {
            log.error("Error anotando schema para subsanación", e);
            return schemaJson;
        }
    }
}
