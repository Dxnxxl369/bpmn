package com.uagrm.gestion.tramites.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiAssistantService {

    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${groq.api.key}")
    private String apiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL = "llama-3.3-70b-versatile";

    /**
     * MÉTODO SIMPLIFICADO para consultas directas (Uso interno del sistema)
     */
    public String consultarIA(String systemPrompt, String userPrompt) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("model", MODEL);
            body.put("temperature", 0.5); // Más bajo para mayor precisión en filtros/datos
            
            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", systemPrompt));
            messages.add(Map.of("role", "user", "content", userPrompt));
            body.put("messages", messages);

            String res = restClient.post()
                .uri(GROQ_URL)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .body(body)
                .retrieve()
                .body(String.class);

            return objectMapper.readTree(res).path("choices").get(0).path("message").path("content").asText().trim();
        } catch (Exception e) {
            log.error("Error en consulta simplificada IA: {}", e.getMessage());
            return "{}";
        }
    }

    public String consultarIA(String pregunta, String modo, String contexto, String manual, String estilo) {
        String finalPregunta = (pregunta != null) ? pregunta : "";
        String finalContexto = (contexto != null) ? contexto : "General";
        String finalManual = (manual != null) ? manual : "No hay manual cargado.";
        
        // REGLA DE ORO DE BREVEDAD
        String styleInstruction = "breve".equalsIgnoreCase(estilo) ? 
            "REGLA DE BREVEDAD: Responde en MENOS DE 40 PALABRAS. Prohibido usar saludos como 'Hola' o frases como 'Aqui tienes'. Ve directo al grano con viñetas." : 
            "RESPONDE DE FORMA DETALLADA: Explica tecnicamente cada punto.";

        String systemPrompt = "";

        if ("guia".equalsIgnoreCase(modo)) {
            systemPrompt = String.format("""
                Eres el Guia de la Plataforma Suite UAGRM. Ayuda a navegar.
                %s
                RUTAS: [DISENADOR IA], [DEPARTAMENTOS], [CASTING HUMANO], [MONITOR GLOBAL].
                """, styleInstruction);
        } else {
            systemPrompt = String.format("""
                Eres un Arquitecto de Procesos. Ayuda a disenar formularios.
                %s
                
                REGLA DE ACCION: Si el usuario te pide crear o modificar campos, ademas de tu explicacion, 
                DEBES incluir el esquema JSON completo encerrado entre las etiquetas <schema> y </schema>.
                Usa el formato: [{"id":"...","label":"...","type":"...","required":true}].
                
                CONTEXTO: Tramite '%s'. Manual: %s
                """, styleInstruction, finalContexto, finalManual);
        }

        return this.consultarIA(systemPrompt, finalPregunta);
    }

    public String generarBorradorDocumento(String prompt, Map<String, Object> contexto) {
        String systemPrompt = """
            Eres un Redactor Jurídico y Administrativo experto. 
            Tu tarea es generar el CONTENIDO HTML de un documento oficial basado en los datos de un formulario y las instrucciones del funcionario.
            
            REGLAS:
            1. Devuelve SOLO el código HTML (etiquetas h2, p, strong, table, etc.). Sin preámbulos.
            2. Usa los datos del CONTEXTO JSON proporcionado para rellenar el documento.
            3. SI UN DATO NO ESTÁ EN EL CONTEXTO, deja un marcador entre corchetes como [NOMBRE_CAMPO] para que sea llenado después.
            4. El estilo debe ser formal, sobrio y elegante.
            """;

        String userMessage = String.format("""
            INSTRUCCIÓN DEL FUNCIONARIO: %s
            
            CONTEXTO DEL FORMULARIO (DATOS DISPONIBLES):
            %s
            """, prompt, contexto.toString());

        return this.consultarIA(systemPrompt, userMessage);
    }
}
