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

        try {
            // Usamos un Map mutable para evitar problemas con valores nulos
            Map<String, Object> body = new HashMap<>();
            body.put("model", MODEL);
            body.put("temperature", 0.7);
            
            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", systemPrompt));
            messages.add(Map.of("role", "user", "content", finalPregunta));
            
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
            log.error("Error en consulta de asistente IA: {}", e.getMessage());
            return "Lo siento, tuve un problema al procesar tu consulta con la IA. Verificando mi conexion...";
        }
    }
}
