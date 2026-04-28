package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.InstanciaProceso;
import com.uagrm.gestion.tramites.model.LinkedTask;
import com.uagrm.gestion.tramites.model.UserDevice;
import com.uagrm.gestion.tramites.repository.InstanciaProcesoRepository;
import com.uagrm.gestion.tramites.repository.LinkedTaskRepository;
import com.uagrm.gestion.tramites.repository.UserDeviceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/mobile")
@RequiredArgsConstructor
public class MobileController {

    private final UserDeviceRepository userDeviceRepository;
    private final LinkedTaskRepository linkedTaskRepository;
    private final InstanciaProcesoRepository instanciaRepository;

    @PostMapping("/device-token")
    public ResponseEntity<?> saveDeviceToken(@RequestBody Map<String, String> payload) {
        String userId = payload.get("userId");
        String fcmToken = payload.get("fcmToken");

        UserDevice device = userDeviceRepository.findByUserId(userId)
                .orElse(new UserDevice());
        
        device.setUserId(userId);
        device.setFcmToken(fcmToken);
        userDeviceRepository.save(device);

        return ResponseEntity.ok(Map.of("message", "Token guardado correctamente"));
    }

    @PostMapping("/vincular-tramite")
    public ResponseEntity<?> linkTask(@RequestBody Map<String, String> payload) {
        String userId = payload.get("userId");
        String token = payload.get("token"); // Puede ser ID o Código de seguimiento
        String verificador = payload.get("verificador");

        // Validar que el trámite exista
        InstanciaProceso instancia = instanciaRepository.findById(token)
                .or(() -> instanciaRepository.findByCodigoSeguimiento(token))
                .orElseThrow(() -> new RuntimeException("Trámite no encontrado"));

        // Aquí se podría validar el verificador (ej. CI o Email coincida con el contexto del trámite)
        // Por ahora lo vinculamos directamente para el prototipo

        LinkedTask linkedTask = new LinkedTask();
        linkedTask.setUserId(userId);
        linkedTask.setProcessInstanceId(instancia.getId()); // Guardamos siempre el ID real
        linkedTask.setVerificador(verificador);
        linkedTaskRepository.save(linkedTask);

        return ResponseEntity.ok(Map.of("message", "Trámite vinculado correctamente"));
    }

    @GetMapping("/mis-tramites")
    public ResponseEntity<List<InstanciaProceso>> getMyTasks(@RequestParam String userId) {
        List<String> instanceIds = linkedTaskRepository.findByUserId(userId).stream()
                .map(LinkedTask::getProcessInstanceId)
                .collect(Collectors.toList());

        List<InstanciaProceso> instancias = (List<InstanciaProceso>) instanciaRepository.findAllById(instanceIds);
        return ResponseEntity.ok(instancias);
    }
}
