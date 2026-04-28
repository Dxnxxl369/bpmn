package com.uagrm.gestion.tramites.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Habilita un broker en memoria para enviar mensajes a los clientes
        config.enableSimpleBroker("/topic");
        // Prefijo para los mensajes que van desde el cliente al servidor
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureWebSocketTransport(org.springframework.web.socket.config.annotation.WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(2048 * 1024); // 2MB
        registration.setSendBufferSizeLimit(2048 * 1024); // 2MB
        registration.setSendTimeLimit(20000);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint de conexión inicial (Handshake)
        registry.addEndpoint("/ws-bpms")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
