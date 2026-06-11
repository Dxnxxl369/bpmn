package com.uagrm.gestion.tramites.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        // Optimizado para payloads pesados (Fotos y XMLs)
        registration.setMessageSizeLimit(10 * 1024 * 1024); 
        registration.setSendBufferSizeLimit(10 * 1024 * 1024);
        registration.setSendTimeLimit(20000);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // TÚNEL 1: SOCIAL (Presencia, Chat, Formularios)
        registry.addEndpoint("/ws-bpms")
                .setAllowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*")
                .withSockJS();

        // TÚNEL 2: LIVE (Diagramas, Movimientos X,Y)
        registry.addEndpoint("/ws-live")
                .setAllowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*")
                .withSockJS();
    }
}
