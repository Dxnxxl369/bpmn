package com.uagrm.gestion.tramites;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PlataformaInteligenteApplication {
    public static void main(String[] args) {
        SpringApplication.run(PlataformaInteligenteApplication.class, args);
    }
}
