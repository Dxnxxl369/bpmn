package com.uagrm.gestion.tramites.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

   // @Override
   // public void addCorsMappings(CorsRegistry registry) {
   //     registry.addMapping("/**")
   //             .allowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*") // RECIBE CUALQUIER PUERTO
   //             .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
   //             .allowedHeaders("*")
   //             .allowCredentials(true);
   // }
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("*") // Permite cualquier origen (App móvil, Web, etc.)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
