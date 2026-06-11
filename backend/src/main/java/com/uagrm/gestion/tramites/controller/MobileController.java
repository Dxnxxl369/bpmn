package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.Usuario;
import com.uagrm.gestion.tramites.repository.UsuarioRepository;
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
    private final UsuarioRepository usuarioRepository;

    @PostMapping("/device-token")
    public ResponseEntity<?> saveDeviceToken(@RequestBody Map<String, String> payload) {
        String userId = payload.get("userId");
        String fcmToken = payload.get("fcmToken");
        String ci = payload.get("ci"); // CI opcional para vinculaciÃ³n definitiva

        UserDevice device = userDeviceRepository.findByUserId(userId)
                .orElse(new UserDevice());
        
        device.setUserId(userId);
        device.setFcmToken(fcmToken);
        userDeviceRepository.save(device);

        // Si se enviÃ³ CI, actualizamos el perfil del usuario para futuras bÃºsquedas directas
        if (ci != null && !ci.isBlank()) {
            usuarioRepository.findById(userId).ifPresent(u -> {
                u.setCi(ci);
                usuarioRepository.save(u);
            });
            
            // TambiÃ©n guardamos una copia del token bajo el CI para bÃºsquedas rÃ¡pidas por CI
            UserDevice ciDevice = userDeviceRepository.findByUserId(ci).orElse(new UserDevice());
            ciDevice.setUserId(ci);
            ciDevice.setFcmToken(fcmToken);
            userDeviceRepository.save(ciDevice);
        }

        return ResponseEntity.ok(Map.of("message", "Token e Identidad sincronizados correctamente"));
    }

    @PostMapping("/vincular-tramite")
    public ResponseEntity<?> linkTask(@RequestBody Map<String, String> payload) {
        String userId = payload.get("userId");
        String token = payload.get("token"); 
        String fcmToken = payload.get("fcmToken");
        String verificador = payload.get("verificador");

        // CASO ESPECIAL: SincronizaciÃ³n de Identidad (Sin trÃ¡mite)
        if ("SYNC_CI".equals(token)) {
            if (userId != null && verificador != null) {
                usuarioRepository.findById(userId).ifPresent(u -> {
                    u.setCi(verificador);
                    usuarioRepository.save(u);
                });
            }
            return ResponseEntity.ok(Map.of("message", "Identidad sincronizada"));
        }

        InstanciaProceso instancia = instanciaRepository.findById(token)
                .or(() -> instanciaRepository.findByCodigoSeguimiento(token))
                .orElseThrow(() -> new RuntimeException("TrÃ¡mite no encontrado"));

        // VALIDACIÃ“N DE PROPIEDAD (CI Match)
        if (userId != null && !userId.equals("GUEST")) {
            Usuario user = usuarioRepository.findById(userId).orElseThrow();
            if (user.getCi() == null || !user.getCi().equals(instancia.getClienteCi())) {
                return ResponseEntity.status(403).body(Map.of("message", "Este trÃ¡mite no le pertenece. El CI registrado no coincide."));
            }
        }

        // EVITAR DUPLICADOS EN LA BASE DE DATOS
        List<LinkedTask> existentes = linkedTaskRepository.findByProcessInstanceId(instancia.getId());
        boolean yaVinculado = existentes.stream().anyMatch(l -> 
            (userId != null && userId.equals(l.getUserId())) || 
            (fcmToken != null && fcmToken.equals(l.getDeviceToken()))
        );

        if (yaVinculado) {
            return ResponseEntity.ok(Map.of("message", "El trÃ¡mite ya estaba vinculado"));
        }

        LinkedTask linkedTask = new LinkedTask();
        linkedTask.setUserId(userId);
        linkedTask.setDeviceToken(fcmToken);
        linkedTask.setProcessInstanceId(instancia.getId()); 
        linkedTask.setVerificador(verificador);
        linkedTaskRepository.save(linkedTask);

        return ResponseEntity.ok(Map.of("message", "TrÃ¡mite vinculado correctamente"));
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
