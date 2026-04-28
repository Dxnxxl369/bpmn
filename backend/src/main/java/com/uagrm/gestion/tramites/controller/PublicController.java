package com.uagrm.gestion.tramites.controller;

import com.uagrm.gestion.tramites.model.EstadoPolitica;
import com.uagrm.gestion.tramites.model.InstanciaProceso;
import com.uagrm.gestion.tramites.model.PoliticaNegocio;
import com.uagrm.gestion.tramites.model.TareaInstancia;
import com.uagrm.gestion.tramites.repository.InstanciaProcesoRepository;
import com.uagrm.gestion.tramites.repository.TareaInstanciaRepository;
import com.uagrm.gestion.tramites.service.PoliticaNegocioService;
import com.uagrm.gestion.tramites.service.ProcesoMotorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicController {

    private final PoliticaNegocioService politicaService; // FIX: Inyección correcta
    private final InstanciaProcesoRepository instanciaRepository;
    private final TareaInstanciaRepository tareaRepository;
    private final ProcesoMotorService motorService;

    // Listar SOLO servicios ACTIVOS para el ciudadano
    @GetMapping("/servicios")
    public ResponseEntity<List<PoliticaNegocio>> listarServicios() {
        return ResponseEntity.ok(politicaService.listarPorEstado(EstadoPolitica.ACTIVA)); 
    }

    @PostMapping("/iniciar")
    public ResponseEntity<Map<String, String>> iniciarTramite(@RequestBody Map<String, String> payload) {
        String politicaId = payload.get("politicaId");
        String nombre = payload.get("nombre");
        
        PoliticaNegocio p = politicaService.obtenerPorId(politicaId)
                .orElseThrow(() -> new RuntimeException("Servicio no encontrado"));
        
        InstanciaProceso instancia = motorService.iniciarInstancia(politicaId, p.getXmlBpmn(), nombre);
        return ResponseEntity.ok(Map.of("token", instancia.getId()));
    }

    @GetMapping("/seguimiento/{token}")
    public ResponseEntity<Map<String, Object>> seguimiento(@PathVariable String token) {
        // Primero intentamos buscar por ID de MongoDB
        InstanciaProceso instancia = instanciaRepository.findById(token)
                .or(() -> instanciaRepository.findByCodigoSeguimiento(token)) // Si no, por código de seguimiento
                .orElseThrow(() -> new RuntimeException("Token o Código de seguimiento no válido"));
                
        String instanciaId = instancia.getId();
        List<TareaInstancia> tareas = tareaRepository.findAll().stream()
                .filter(t -> t.getInstanciaProcesoId().equals(instanciaId))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
            "instancia", instancia,
            "tareas", tareas,
            "nodoActual", instancia.getNodoActualId() != null ? instancia.getNodoActualId() : "Inicio",
            "estado", instancia.getEstado()
        ));
    }
}
