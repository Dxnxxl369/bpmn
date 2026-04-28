package com.uagrm.gestion.tramites.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;

import java.util.Map;
import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class WebSocketController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // MEMORIA DE USUARIOS EN LÍNEA
    private static final Map<String, Object> usuariosEnLinea = new ConcurrentHashMap<>();

    @MessageMapping("/politica/{id}/editar")
    public void sincronizarDiagrama(@DestinationVariable String id, Map<String, Object> payload) {
        System.out.println("📢 [WS SERVER] Difundiendo cambio de diagrama para: " + id);
        messagingTemplate.convertAndSend("/topic/politica/" + id, payload);
    }

    @MessageMapping("/form-presence/{id}")
    @SendTo("/topic/form-presence/{id}")
    public Object sincronizarPresenciaFormulario(@DestinationVariable String id, Object payload) {
        return payload;
    }

    @MessageMapping("/form-sync/{id}")
    @SendTo("/topic/form-sync/{id}")
    public Object sincronizarEsquemaFormulario(@DestinationVariable String id, Object payload) {
        return payload;
    }

    /**
     * Canal Global de Presencia: Devuelve siempre la colección completa.
     */
    @MessageMapping("/global-presence")
    @SendTo("/topic/global-presence")
    public Collection<Object> presenceGlobal(Map<String, Object> payload) {
        String userId = (String) payload.get("userId");
        String sessionId = (String) payload.get("sessionId");
        String action = (String) payload.get("action");

        if (userId != null && !userId.isEmpty()) {
            String key = userId + "_" + (sessionId != null ? sessionId : "default");
            
            if ("leave".equals(action)) {
                usuariosEnLinea.remove(key);
            } else {
                // LIMPIEZA PROACTIVA: Eliminar cualquier entrada previa del mismo userId pero con diferente sessionId
                // Esto evita que si cerró la pestaña sin hacer logout, se queden sus clones.
                usuariosEnLinea.keySet().removeIf(k -> k.startsWith(userId + "_") && !k.equals(key));
                
                usuariosEnLinea.put(key, payload);
            }
        }
        return usuariosEnLinea.values();
    }

    @MessageMapping("/global-chat")
    @SendTo("/topic/global-chat")
    public Object collaborativeChat(Object message) {
        return message;
    }

    @MessageMapping("/private-chat")
    public void sendPrivateMessage(Map<String, Object> payload) {
        String toId = (String) payload.get("toId");
        if (toId != null) {
            messagingTemplate.convertAndSend("/topic/chat/" + toId, payload);
        }
    }
}
