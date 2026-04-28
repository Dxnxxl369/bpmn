package com.uagrm.gestion.tramites.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
@RequiredArgsConstructor
public class DiagramaWsController {

    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/diagrama/{politicaId}/cambio")
    public void sincronizarCambio(@DestinationVariable String politicaId, Map<String, String> payload) {
        // payload contiene {sessionId, xml}
        messagingTemplate.convertAndSend("/topic/diagrama/" + politicaId, payload);
    }

    @MessageMapping("/diagrama/{politicaId}/actividad")
    public void reportarActividad(@DestinationVariable String politicaId, Map<String, String> payload) {
        // Para rastrear usuarios activos
        messagingTemplate.convertAndSend("/topic/diagrama/" + politicaId + "/usuarios-activos", payload);
    }
}
