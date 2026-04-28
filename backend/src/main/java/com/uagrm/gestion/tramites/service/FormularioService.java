package com.uagrm.gestion.tramites.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class FormularioService {

    private static final Logger log = LoggerFactory.getLogger(FormularioService.class);
    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${groq.api.key}")
    private String apiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL    = "llama-3.3-70b-versatile";//"llama-3.1-8b-instant";//"llama-3.3-70b-versatile";

    public String generateFormFields(String taskName, String taskDocumentation, String processContext, List<String> decisionOptions) {
        String decisionText = "";
        if (decisionOptions != null && !decisionOptions.isEmpty()) {
            decisionText = "\nREGLA CRÍTICA: Esta es una tarea de decisión. DEBES incluir obligatoriamente un campo de tipo 'select' con id 'decision_motor' y las siguientes opciones exactas: " + decisionOptions.toString() + ".";
        }

        String systemPrompt = """
            Eres un diseñador de formularios empresariales senior. Tu tarea es generar los campos de formulario necesarios.
            """ + decisionText + """
            
            Devuelve ÚNICAMENTE un array JSON válido sin markdown.
            Estructura: {id, label, type (text/date/number/select/file/textarea), required, options (solo para select)}.
            """;

        String userPrompt = String.format(
            "Tarea: [%s]. Descripción: [%s]. Proceso: [%s]",
            taskName, taskDocumentation, processContext
        );

        try {
            return callGroq(userPrompt, systemPrompt);
        } catch (Exception e) {
            log.error("Error al generar campos de formulario", e);
            return "[]";
        }
    }

    /**
     * MAGIA DEL EJECUTIVO: Extrae datos de documentos para rellenar el formulario.
     */
    public String predictFormResponses(String schemaJson, String documentText) {
        String systemPrompt = """
            Eres un asistente administrativo de élite. Tu tarea es extraer información precisa
            de los documentos proporcionados para rellenar un formulario electrónico.

            REGLAS ESTRICTAS:
            1. Recibirás un JSON con la estructura del formulario (id, label, type).
            2. Recibirás el texto extraído de los documentos (CI, Facturas, etc.).
            3. Devuelve UNICAMENTE un objeto JSON donde las LLAVES sean los 'id' del formulario
               y los VALORES sean la información encontrada.
            4. Si un dato no existe en el documento, deja el valor como "".
            5. Formatos: Fechas -> YYYY-MM-DD, Números -> solo dígitos.
            6. Sé inteligente: si el campo es 'Nombre' y el documento dice 'Nombres: Juan Perez', extrae 'Juan Perez'.
            7. NO inventes datos. Si no estás seguro, deja vacío.
            """;

        String userPrompt = String.format(
            "ESQUEMA DEL FORMULARIO:\n%s\n\nCONTENIDO DE DOCUMENTOS:\n%s",
            schemaJson, documentText
        );

        try {
            return callGroq(userPrompt, systemPrompt);
        } catch (Exception e) {
            log.error("Error en la predicción de respuestas IA", e);
            return "{}";
        }
    }

    private String cleanJsonResponse(String raw) {
        if (raw == null) return "[]";
        String c = raw.trim();
        if (c.startsWith("```")) {
            c = c.replaceFirst("```(json)?\\s*", "");
            int last = c.lastIndexOf("```");
            if (last != -1) c = c.substring(0, last).trim();
        }
        return c;
    }

    private String callGroq(String userPrompt, String systemPrompt) throws Exception {
        Map<String, Object> body = Map.of(
            "model", MODEL,
            "messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user",   "content", userPrompt)
            ),
            "temperature", 0.1
        );
        String res = restClient.post()
            .uri(GROQ_URL)
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .body(body).retrieve().body(String.class);
        return objectMapper.readTree(res).path("choices").get(0).path("message").path("content").asText().trim();
    }
}
