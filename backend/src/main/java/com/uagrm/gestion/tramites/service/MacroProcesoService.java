package com.uagrm.gestion.tramites.service;

import com.uagrm.gestion.tramites.model.MacroProcesoPaso;
import com.uagrm.gestion.tramites.repository.MacroProcesoPasoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MacroProcesoService {

    private final MacroProcesoPasoRepository pasoRepository;
    private final ProcesoMotorService motorService;

    public void iniciarMacroProceso(String macroprocesoId, String xmlBpmnInicial, String politicaInicialId, String solicitante) {
        // Guardar la configuración del macroproceso
        // Iniciar la primera instancia
        motorService.iniciarInstancia(politicaInicialId, xmlBpmnInicial, solicitante);
    }
}
