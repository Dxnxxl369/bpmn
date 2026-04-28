package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.service.AiAssistantService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ia")
@RequiredArgsConstructor
public class AiAssistantController {

    private final AiAssistantService assistantService;

    @PostMapping("/chat-asistente")
    public Map<String, String> chatear(@RequestBody Map<String, String> payload) {
        String pregunta = payload.get("pregunta");
        String modo = payload.get("modo");
        String contexto = payload.get("contexto");
        String manual = payload.get("manual");
        String estilo = payload.get("estilo"); // AÑADIDO

        String respuesta = assistantService.consultarIA(pregunta, modo, contexto, manual, estilo);
        return Map.of("respuesta", respuesta);
    }
}
