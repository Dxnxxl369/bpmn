package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.service.AuditoriaService;
import com.uagrm.gestion.tramites.service.PoliticaNegocioService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import lombok.RequiredArgsConstructor;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Controller
@RequiredArgsConstructor
public class WebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final PoliticaNegocioService politicaService;
    private final AuditoriaService auditoriaService;

    // MAPA MAESTRO: Estado total de cada sesión conectada
    private final Map<String, Map<String, Object>> usuariosEnLinea = new ConcurrentHashMap<>();

    @MessageMapping("/global-presence")
    public void presenceGlobal(Map<String, Object> payload) {
        String userId = (String) payload.get("userId");
        String sessionId = (String) payload.get("sessionId");
        String action = (String) payload.get("action");

        if (userId != null && sessionId != null) {
            String key = userId + "_" + sessionId;
            
            if ("leave".equals(action)) {
                usuariosEnLinea.remove(key);
            } else {
                Map<String, Object> existing = usuariosEnLinea.get(key);
                if (existing != null) {
                    if (payload.get("avatar") == null) payload.put("avatar", existing.get("avatar"));
                    if (payload.get("activity") == null) payload.put("activity", existing.get("activity"));
                    if (payload.get("politicaId") == null) payload.put("politicaId", existing.get("politicaId"));
                }
                payload.put("timestamp", System.currentTimeMillis());
                usuariosEnLinea.put(key, payload);
            }
        }
        
        // FORZAR ENVÍO EXPLÍCITO A TODOS
        messagingTemplate.convertAndSend("/topic/global-presence", usuariosEnLinea.values());
    }

    @MessageMapping("/politica/{id}/editar")
    public void actualizarXml(@DestinationVariable String id, Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/politica/" + id, payload);
        politicaService.actualizarXmlAsync(id, (String) payload.get("xml"), (String) payload.get("userName"));
    }

    @MessageMapping("/politica/{id}/mover")
    @SendTo("/topic/politica/{id}/movimientos")
    public Map<String, Object> moverNodo(@DestinationVariable String id, Map<String, Object> payload) {
        return payload;
    }

    @MessageMapping("/form-sync/{id}")
    @SendTo("/topic/form-sync/{id}")
    public Map<String, Object> sincronizarEsquema(@DestinationVariable String id, Map<String, Object> payload) {
        return payload;
    }

    @MessageMapping("/form-presence/{id}")
    @SendTo("/topic/form-presence/{id}")
    public Map<String, Object> sincronizarPresenciaFormulario(@DestinationVariable String id, Map<String, Object> payload) {
        return payload;
    }

    // --- CANALES DE EDICIÓN COLABORATIVA DE DOCUMENTOS (FASE FINAL) ---

    @MessageMapping("/doc-sync/{instanciaId}")
    @SendTo("/topic/doc-sync/{instanciaId}")
    public Map<String, Object> sincronizarDocumento(@DestinationVariable String instanciaId, Map<String, Object> payload) {
        // Payload: { content: "HTML del documento...", sender: "email@..." }
        return payload;
    }

    @MessageMapping("/doc-cursors/{instanciaId}")
    @SendTo("/topic/doc-cursors/{instanciaId}")
    public Map<String, Object> sincronizarCursoresDocumento(@DestinationVariable String instanciaId, Map<String, Object> payload) {
        // Payload: { x: 150, y: 300, name: "María (Legal)", sender: "email@..." }
        return payload;
    }

    @MessageMapping("/ai-highlight/{id}")
    @SendTo("/topic/ai-highlight/{id}")
    public Map<String, Object> notificarResaltadoIA(@DestinationVariable String id, Map<String, Object> payload) {
        // Payload: { fieldId, docId, coords: {x, y, w, h}, label }
        return payload;
    }

    @MessageMapping("/private-chat")
    public void sendPrivateMessage(Map<String, Object> payload) {
        String toId = (String) payload.get("toId");
        if (toId != null) {
            messagingTemplate.convertAndSend("/topic/chat/" + toId, payload);
        }
    }
}
