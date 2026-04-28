package com.uagrm.gestion.tramites.service;

import com.uagrm.gestion.tramites.model.EstadisticaTarea;
import com.uagrm.gestion.tramites.model.TareaInstancia;
import com.uagrm.gestion.tramites.repository.EstadisticaTareaRepository;
import com.uagrm.gestion.tramites.repository.TareaInstanciaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class TareaMonitorScheduler {

    private final TareaInstanciaRepository tareaRepository;
    private final EstadisticaTareaRepository estadisticaRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedRate = 60000) // Cada minuto
    public void detectarCuellosBotella() {
        /* Comentado temporalmente para pruebas de migración
        List<TareaInstancia> enProceso = tareaRepository.findAll().stream()
                .filter(t -> "EN_PROCESO".equals(t.getEstado()))
                .toList();
        ... */
    }
}
